"""Standard Knowledge Ingestion Pipeline:
Import → Parse → Clean → Normalize → Deduplicate → Chunk → Metadata → Categorize → Tag → Embed → Index → Knowledge Graph
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import (
    Source, Document, Chunk, Category, Concept, DocumentConcept,
    ConceptRelationship, QualityIssue, ActivityLog,
    SourceType, SourceStatus, ContentType, QualityIssueType, RelationType,
)
from app.db.base import engine

settings = get_settings()


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")[:200]


def clean_text(text: str) -> str:
    if not text:
        return ""
    # fix encoding issues
    text = text.encode("utf-8", errors="ignore").decode("utf-8")
    text = unicodedata.normalize("NFKC", text)
    # remove null bytes and control chars except newline/tab
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> List[Dict[str, Any]]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP
    if not text or len(text) < settings.MIN_CHUNK_LENGTH:
        return []

    # Prefer splitting on paragraphs then sentences
    paragraphs = re.split(r"\n\s*\n", text)
    chunks = []
    current = ""
    start = 0
    char_pos = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 1 <= chunk_size:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            if current and len(current) >= settings.MIN_CHUNK_LENGTH:
                chunks.append({
                    "content": current,
                    "start_char": start,
                    "end_char": start + len(current),
                    "token_count": len(current.split()),
                })
            # overlap
            if overlap and current:
                words = current.split()
                overlap_text = " ".join(words[-overlap // 5 :]) if len(words) > overlap // 5 else ""
                current = f"{overlap_text}\n\n{para}".strip() if overlap_text else para
                start = char_pos - len(overlap_text) if overlap_text else char_pos
            else:
                current = para
                start = char_pos
        char_pos += len(para) + 2

    if current and len(current) >= settings.MIN_CHUNK_LENGTH:
        chunks.append({
            "content": current,
            "start_char": start,
            "end_char": start + len(current),
            "token_count": len(current.split()),
        })

    # If still too large, hard-split
    final = []
    for i, ch in enumerate(chunks):
        if len(ch["content"]) <= chunk_size * 1.5:
            ch["chunk_index"] = i
            final.append(ch)
        else:
            words = ch["content"].split()
            step = max(1, chunk_size // 5)
            for j in range(0, len(words), step - overlap // 5):
                piece = " ".join(words[j : j + step])
                if len(piece) >= settings.MIN_CHUNK_LENGTH:
                    final.append({
                        "content": piece,
                        "start_char": ch["start_char"],
                        "end_char": ch["end_char"],
                        "token_count": len(piece.split()),
                        "chunk_index": len(final),
                    })
    return final


# Simple concept extraction via noun-phrase heuristics (no LLM required)
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can", "this", "that", "these", "those",
    "it", "its", "they", "them", "their", "we", "our", "you", "your", "he", "she",
    "his", "her", "which", "who", "whom", "what", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just",
}


def extract_concepts(text: str, max_concepts: int = 15) -> List[str]:
    """Lightweight keyword/phrase extraction without external NLP models."""
    # Capitalized multi-word phrases and frequent significant terms
    phrases = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    freq: Dict[str, int] = {}
    for w in words:
        if w not in STOPWORDS:
            freq[w] = freq.get(w, 0) + 1
    # top words
    top_words = sorted(freq.items(), key=lambda x: -x[1])[:max_concepts]
    concepts = list(dict.fromkeys(phrases[:8] + [w for w, _ in top_words if _ >= 2]))
    return concepts[:max_concepts]


@dataclass
class PipelineStep:
    name: str
    status: str = "pending"  # pending | running | done | error
    message: str = ""
    duration_ms: int = 0


@dataclass
class PipelineResult:
    success: bool
    document_id: Optional[int] = None
    chunk_count: int = 0
    concept_count: int = 0
    steps: List[PipelineStep] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    is_duplicate: bool = False


class IngestionPipeline:
    """Observable, debuggable ingestion pipeline."""

    def __init__(self, db: Session, on_step: Optional[Callable[[PipelineStep], None]] = None):
        self.db = db
        self.on_step = on_step
        self.steps: List[PipelineStep] = []

    def _step(self, name: str) -> PipelineStep:
        s = PipelineStep(name=name, status="running")
        self.steps.append(s)
        if self.on_step:
            self.on_step(s)
        return s

    def _done(self, step: PipelineStep, message: str = ""):
        step.status = "done"
        step.message = message
        if self.on_step:
            self.on_step(step)

    def _error(self, step: PipelineStep, message: str):
        step.status = "error"
        step.message = message
        if self.on_step:
            self.on_step(step)

    def process(
        self,
        source: Source,
        title: str,
        content: str,
        url: Optional[str] = None,
        content_type: ContentType = ContentType.WEBPAGE,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        category_id: Optional[int] = None,
    ) -> PipelineResult:
        result = PipelineResult(success=False)
        metadata = metadata or {}
        tags = tags or source.tags or []

        # 1. Clean
        step = self._step("clean")
        try:
            content = clean_text(content)
            title = clean_text(title) or url or "Untitled"
            if not content or len(content) < 20:
                self._error(step, "Content too short or empty")
                self._record_quality(source.id, "document", 0, QualityIssueType.EMPTY, "Empty or too short content")
                result.errors.append("Empty content")
                result.steps = self.steps
                return result
            self._done(step, f"{len(content)} chars")
        except Exception as e:
            self._error(step, str(e))
            result.errors.append(str(e))
            result.steps = self.steps
            return result

        # 2. Normalize & Hash
        step = self._step("normalize")
        ch = sha256(content)
        self._done(step, ch[:12])

        # 3. Deduplicate
        step = self._step("deduplicate")
        existing = self.db.query(Document).filter(
            Document.source_id == source.id,
            Document.content_hash == ch,
        ).first()
        if existing:
            self._done(step, f"Duplicate of doc #{existing.id}")
            result.is_duplicate = True
            result.document_id = existing.id
            result.success = True
            result.steps = self.steps
            return result

        # cross-source duplicate check
        cross = self.db.query(Document).filter(Document.content_hash == ch).first()
        is_dup = False
        dup_of = None
        if cross:
            is_dup = True
            dup_of = cross.id
            self._record_quality(source.id, "document", 0, QualityIssueType.DUPLICATE, f"Duplicate of document #{cross.id}")
        self._done(step, "unique" if not is_dup else f"cross-dup of #{dup_of}")

        # 4. Create Document
        step = self._step("create_document")
        doc = Document(
            source_id=source.id,
            title=title[:1000],
            url=url,
            content_type=content_type,
            content=content,
            content_hash=ch,
            word_count=len(content.split()),
            category_id=category_id or source.category_id,
            tags=tags,
            metadata_=metadata,
            is_duplicate=is_dup,
            duplicate_of_id=dup_of,
            quality_score=0.5 if is_dup else 1.0,
        )
        # simple summary: first 2 sentences
        sentences = re.split(r"(?<=[.!?])\s+", content)
        doc.summary = " ".join(sentences[:2])[:500]
        self.db.add(doc)
        self.db.flush()
        self._done(step, f"doc #{doc.id}")

        # 5. Chunk
        step = self._step("chunk")
        chunks_data = chunk_text(content)
        chunk_objs = []
        for cd in chunks_data:
            c = Chunk(
                document_id=doc.id,
                source_id=source.id,
                chunk_index=cd.get("chunk_index", len(chunk_objs)),
                content=cd["content"],
                content_hash=sha256(cd["content"]),
                token_count=cd.get("token_count", 0),
                start_char=cd.get("start_char"),
                end_char=cd.get("end_char"),
            )
            self.db.add(c)
            chunk_objs.append(c)
        self.db.flush()
        self._done(step, f"{len(chunk_objs)} chunks")

        # 6. Index FTS
        step = self._step("index_fts")
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql(
                    "INSERT INTO documents_fts(document_id, title, content, summary) VALUES (?, ?, ?, ?)",
                    (doc.id, doc.title, content[:50000], doc.summary or ""),
                )
                for c in chunk_objs:
                    conn.exec_driver_sql(
                        "INSERT INTO chunks_fts(chunk_id, content, title, tags, category) VALUES (?, ?, ?, ?, ?)",
                        (c.id, c.content, doc.title, " ".join(tags), ""),
                    )
                conn.commit()
            self._done(step, "FTS indexed")
        except Exception as e:
            self._error(step, str(e))
            result.errors.append(f"FTS: {e}")

        # 7. Concepts
        step = self._step("concepts")
        concepts = extract_concepts(content)
        concept_count = 0
        for name in concepts:
            slug = slugify(name)
            if not slug:
                continue
            concept = self.db.query(Concept).filter(Concept.slug == slug).first()
            if not concept:
                concept = Concept(name=name, slug=slug, mention_count=1)
                self.db.add(concept)
                self.db.flush()
            else:
                concept.mention_count += 1
            dc = DocumentConcept(document_id=doc.id, concept_id=concept.id, relevance=1.0)
            self.db.add(dc)
            concept_count += 1
        self.db.flush()
        self._done(step, f"{concept_count} concepts")

        # 8. Update source counts
        step = self._step("update_source")
        source.document_count = self.db.query(Document).filter(Document.source_id == source.id).count()
        source.chunk_count = self.db.query(Chunk).filter(Chunk.source_id == source.id).count()
        source.last_updated = datetime.utcnow()
        source.status = SourceStatus.READY
        self.db.add(ActivityLog(
            action="document_ingested",
            entity_type="document",
            entity_id=doc.id,
            details={"source_id": source.id, "title": title, "chunks": len(chunk_objs)},
        ))
        self.db.commit()
        self._done(step, "ok")

        result.success = True
        result.document_id = doc.id
        result.chunk_count = len(chunk_objs)
        result.concept_count = concept_count
        result.steps = self.steps
        return result

    def _record_quality(self, source_id: int, entity_type: str, entity_id: int, issue_type: QualityIssueType, desc: str):
        qi = QualityIssue(
            issue_type=issue_type,
            entity_type=entity_type,
            entity_id=entity_id or source_id,
            description=desc,
            severity="warning",
        )
        self.db.add(qi)


# ─── File parsers ────────────────────────────────────────────────────────────

def parse_pdf(file_path: Path) -> tuple[str, str]:
    from pypdf import PdfReader
    reader = PdfReader(str(file_path))
    parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    content = "\n\n".join(parts)
    title = file_path.stem
    if reader.metadata and reader.metadata.title:
        title = str(reader.metadata.title)
    return title, content


def parse_docx(file_path: Path) -> tuple[str, str]:
    from docx import Document as DocxDocument
    doc = DocxDocument(str(file_path))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    content = "\n\n".join(parts)
    title = file_path.stem
    return title, content


def parse_txt(file_path: Path) -> tuple[str, str]:
    raw = file_path.read_bytes()
    import chardet
    detected = chardet.detect(raw)
    encoding = detected.get("encoding") or "utf-8"
    content = raw.decode(encoding, errors="replace")
    return file_path.stem, content


def parse_markdown(file_path: Path) -> tuple[str, str]:
    content = file_path.read_text(encoding="utf-8", errors="replace")
    # first heading as title
    m = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = m.group(1).strip() if m else file_path.stem
    return title, content


def parse_html_file(file_path: Path) -> tuple[str, str]:
    from app.crawler.engine import extract_main_content
    html = file_path.read_text(encoding="utf-8", errors="replace")
    title, content, _, _ = extract_main_content(html, str(file_path))
    return title or file_path.stem, content


def parse_csv(file_path: Path) -> tuple[str, str]:
    import csv
    rows = []
    with open(file_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i > 500:
                break
            rows.append(" | ".join(row))
    content = "\n".join(rows)
    return file_path.stem, content


def parse_json_file(file_path: Path) -> tuple[str, str]:
    import json
    data = json.loads(file_path.read_text(encoding="utf-8"))
    content = json.dumps(data, indent=2, ensure_ascii=False)
    return file_path.stem, content


PARSERS = {
    ".pdf": parse_pdf,
    ".docx": parse_docx,
    ".txt": parse_txt,
    ".md": parse_markdown,
    ".markdown": parse_markdown,
    ".html": parse_html_file,
    ".htm": parse_html_file,
    ".csv": parse_csv,
    ".json": parse_json_file,
}
