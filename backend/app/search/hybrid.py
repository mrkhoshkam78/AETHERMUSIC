"""Hybrid Search Engine: Keyword + FTS + Fuzzy + Metadata + Graph + optional Semantic."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set

from sqlalchemy import text, or_, and_
from sqlalchemy.orm import Session
from rapidfuzz import fuzz

from app.core.config import get_settings
from app.models.entities import (
    Document, Chunk, Source, Concept, ConceptRelationship,
    DocumentConcept, Category, RelationType,
)

settings = get_settings()


@dataclass
class SearchHit:
    chunk_id: Optional[int] = None
    document_id: int = 0
    source_id: int = 0
    title: str = ""
    content: str = ""
    url: Optional[str] = None
    score: float = 0.0
    match_type: str = "keyword"  # keyword | fts | fuzzy | semantic | graph | metadata
    highlights: List[str] = field(default_factory=list)
    source_name: str = ""
    source_type: str = ""
    tags: List[str] = field(default_factory=list)
    category: Optional[str] = None
    concepts: List[str] = field(default_factory=list)
    reason: str = ""


@dataclass
class SearchResult:
    query: str
    expanded_terms: List[str] = field(default_factory=list)
    hits: List[SearchHit] = field(default_factory=list)
    total: int = 0
    concepts_found: List[Dict] = field(default_factory=list)
    took_ms: int = 0


# Query understanding without LLM
SYNONYM_MAP = {
    "interest rate": ["interest rates", "federal funds rate", "monetary policy", "central bank rate", "nazar rate"],
    "gold": ["gold price", "xau", "precious metals", "bullion"],
    "inflation": ["cpi", "price increase", "purchasing power", "monetary inflation"],
    "ai": ["artificial intelligence", "machine learning", "llm", "neural network"],
    "python": ["python programming", "django", "fastapi", "flask"],
}


def analyze_query(query: str) -> Dict[str, Any]:
    """Decompose query into terms, phrases, possible concepts."""
    q = query.strip().lower()
    # quoted phrases
    phrases = re.findall(r'"([^"]+)"', query)
    # remove quotes for term extraction
    clean = re.sub(r'"[^"]+"', " ", q)
    terms = [t for t in re.findall(r"\b\w{2,}\b", clean) if t not in (
        "the", "a", "an", "is", "are", "was", "were", "what", "why", "how", "does",
        "do", "did", "on", "in", "to", "of", "for", "and", "or", "with", "from",
        "که", "از", "به", "در", "با", "را", "این", "آن", "چیست", "چرا", "چگونه",
    )]
    expanded = list(terms)
    for key, syns in SYNONYM_MAP.items():
        if key in q or any(t in key.split() for t in terms):
            expanded.extend(syns)
        for s in syns:
            if s in q:
                expanded.append(key)
                expanded.extend(syns)
    expanded = list(dict.fromkeys(expanded))
    return {
        "original": query,
        "terms": terms,
        "phrases": phrases,
        "expanded": expanded,
        "is_question": any(w in q for w in ("?", "why", "how", "what", "when", "who", "چرا", "چگونه", "چیست")),
    }


class HybridSearch:
    def __init__(self, db: Session):
        self.db = db

    def search(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0,
        category_id: Optional[int] = None,
        source_id: Optional[int] = None,
        tags: Optional[List[str]] = None,
        mode: str = "hybrid",  # hybrid | keyword | semantic | exact
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> SearchResult:
        import time
        t0 = time.time()
        analysis = analyze_query(query)
        hits_map: Dict[int, SearchHit] = {}  # document_id -> best hit

        if mode in ("hybrid", "keyword", "exact"):
            self._fts_search(query, analysis, hits_map, limit * 3)
            self._fuzzy_search(analysis, hits_map, limit)
            self._metadata_search(analysis, hits_map)

        if mode in ("hybrid", "semantic"):
            # Semantic is optional; falls back to concept graph
            self._concept_search(analysis, hits_map)

        self._graph_expand(hits_map)

        # Apply filters
        filtered = []
        for hit in hits_map.values():
            if source_id and hit.source_id != source_id:
                continue
            if tags:
                if not any(t in (hit.tags or []) for t in tags):
                    continue
            filtered.append(hit)

        # Rank
        filtered.sort(key=lambda h: h.score, reverse=True)
        total = len(filtered)
        page = filtered[offset : offset + limit]

        # Enrich with source names
        for hit in page:
            src = self.db.get(Source, hit.source_id)
            if src:
                hit.source_name = src.name
                hit.source_type = src.source_type.value if src.source_type else ""

        concepts = self._find_concepts(analysis)

        return SearchResult(
            query=query,
            expanded_terms=analysis["expanded"],
            hits=page,
            total=total,
            concepts_found=concepts,
            took_ms=int((time.time() - t0) * 1000),
        )

    def _fts_search(self, query: str, analysis: Dict, hits_map: Dict, limit: int):
        # Escape FTS special chars
        fts_q = re.sub(r'[^\w\s]', ' ', query)
        terms = analysis["terms"]
        if not fts_q.strip() and not terms:
            return

        # Prefer phrase if quoted, else OR of terms
        if analysis["phrases"]:
            match_expr = " AND ".join(f'"{p}"' for p in analysis["phrases"])
        elif terms:
            match_expr = " OR ".join(terms[:10])
        else:
            match_expr = fts_q

        try:
            rows = self.db.execute(text("""
                SELECT chunk_id, content, title, rank
                FROM chunks_fts
                WHERE chunks_fts MATCH :q
                ORDER BY rank
                LIMIT :lim
            """), {"q": match_expr, "lim": limit}).fetchall()
        except Exception:
            # fallback simple LIKE
            rows = []
            for term in terms[:5]:
                chunks = self.db.query(Chunk).filter(Chunk.content.ilike(f"%{term}%")).limit(20).all()
                for c in chunks:
                    rows.append((c.id, c.content, "", -1.0))

        for row in rows:
            chunk_id, content, title, rank = row[0], row[1], row[2], row[3] if len(row) > 3 else -1
            chunk = self.db.get(Chunk, chunk_id)
            if not chunk:
                continue
            doc = self.db.get(Document, chunk.document_id)
            if not doc:
                continue
            score = abs(float(rank)) if rank and rank < 0 else 0.5
            # BM25-ish: rank is negative in FTS5
            score = min(1.0, 0.3 + score * 0.1) if rank else 0.4
            score *= settings.BM25_WEIGHT * 2  # normalize

            existing = hits_map.get(doc.id)
            if not existing or score > existing.score:
                highlights = self._highlight(content, analysis["terms"])
                hits_map[doc.id] = SearchHit(
                    chunk_id=chunk.id,
                    document_id=doc.id,
                    source_id=doc.source_id,
                    title=doc.title,
                    content=content[:600],
                    url=doc.url,
                    score=score,
                    match_type="fts",
                    highlights=highlights,
                    tags=doc.tags or [],
                    reason=f"Full-text match on: {', '.join(analysis['terms'][:5])}",
                )

    def _fuzzy_search(self, analysis: Dict, hits_map: Dict, limit: int):
        if not analysis["terms"]:
            return
        # Sample recent documents for fuzzy
        docs = self.db.query(Document).filter(Document.is_duplicate == False).order_by(Document.id.desc()).limit(200).all()
        for doc in docs:
            title_score = max((fuzz.partial_ratio(t, doc.title.lower()) for t in analysis["terms"]), default=0)
            if title_score > 70:
                score = (title_score / 100.0) * settings.FUZZY_WEIGHT * 3
                existing = hits_map.get(doc.id)
                if not existing or score > existing.score * 0.5:
                    if not existing:
                        hits_map[doc.id] = SearchHit(
                            document_id=doc.id,
                            source_id=doc.source_id,
                            title=doc.title,
                            content=(doc.summary or doc.content or "")[:600],
                            url=doc.url,
                            score=score,
                            match_type="fuzzy",
                            tags=doc.tags or [],
                            reason=f"Fuzzy title match ({title_score}%)",
                        )
                    else:
                        existing.score += score * 0.3
                        if existing.match_type != "fuzzy":
                            existing.reason += f" + fuzzy ({title_score}%)"

    def _metadata_search(self, analysis: Dict, hits_map: Dict):
        for term in analysis["expanded"][:8]:
            docs = self.db.query(Document).filter(
                Document.title.ilike(f"%{term}%")
            ).limit(30).all()
            # Match tags in Python (JSON column)
            for doc in self.db.query(Document).limit(300).all():
                tags = doc.tags or []
                if any(term.lower() in str(t).lower() for t in tags):
                    if doc not in docs:
                        docs.append(doc)
            for doc in docs:
                score = settings.METADATA_WEIGHT
                existing = hits_map.get(doc.id)
                if not existing:
                    hits_map[doc.id] = SearchHit(
                        document_id=doc.id,
                        source_id=doc.source_id,
                        title=doc.title,
                        content=(doc.summary or "")[:600],
                        url=doc.url,
                        score=score,
                        match_type="metadata",
                        tags=doc.tags or [],
                        reason=f"Metadata/tag match: {term}",
                    )
                else:
                    existing.score += score * 0.5

    def _concept_search(self, analysis: Dict, hits_map: Dict):
        for term in analysis["expanded"][:10]:
            concepts = self.db.query(Concept).filter(
                or_(
                    Concept.name.ilike(f"%{term}%"),
                    Concept.slug.ilike(f"%{term}%"),
                )
            ).limit(5).all()
            for concept in concepts:
                dcs = self.db.query(DocumentConcept).filter(
                    DocumentConcept.concept_id == concept.id
                ).limit(20).all()
                for dc in dcs:
                    doc = self.db.get(Document, dc.document_id)
                    if not doc:
                        continue
                    score = dc.relevance * settings.SEMANTIC_WEIGHT
                    existing = hits_map.get(doc.id)
                    if not existing:
                        hits_map[doc.id] = SearchHit(
                            document_id=doc.id,
                            source_id=doc.source_id,
                            title=doc.title,
                            content=(doc.summary or "")[:600],
                            url=doc.url,
                            score=score,
                            match_type="semantic",
                            tags=doc.tags or [],
                            concepts=[concept.name],
                            reason=f"Concept match: {concept.name}",
                        )
                    else:
                        existing.score += score * 0.4
                        if concept.name not in existing.concepts:
                            existing.concepts.append(concept.name)
                        existing.reason += f" + concept:{concept.name}"

    def _graph_expand(self, hits_map: Dict):
        """Boost documents linked via knowledge graph."""
        concept_ids: Set[int] = set()
        for hit in list(hits_map.values()):
            dcs = self.db.query(DocumentConcept).filter(
                DocumentConcept.document_id == hit.document_id
            ).all()
            for dc in dcs:
                concept_ids.add(dc.concept_id)

        if not concept_ids:
            return

        # Find related concepts
        rels = self.db.query(ConceptRelationship).filter(
            or_(
                ConceptRelationship.from_concept_id.in_(concept_ids),
                ConceptRelationship.to_concept_id.in_(concept_ids),
            )
        ).limit(50).all()

        related_ids = set()
        for r in rels:
            related_ids.add(r.from_concept_id)
            related_ids.add(r.to_concept_id)
        related_ids -= concept_ids

        for cid in list(related_ids)[:20]:
            dcs = self.db.query(DocumentConcept).filter(
                DocumentConcept.concept_id == cid
            ).limit(5).all()
            for dc in dcs:
                if dc.document_id in hits_map:
                    hits_map[dc.document_id].score += 0.05 * dc.relevance
                    hits_map[dc.document_id].reason += " + graph"

    def _find_concepts(self, analysis: Dict) -> List[Dict]:
        found = []
        for term in analysis["expanded"][:10]:
            concepts = self.db.query(Concept).filter(
                Concept.name.ilike(f"%{term}%")
            ).limit(3).all()
            for c in concepts:
                found.append({"id": c.id, "name": c.name, "mentions": c.mention_count})
        return found

    def _highlight(self, content: str, terms: List[str]) -> List[str]:
        highlights = []
        lower = content.lower()
        for term in terms[:5]:
            idx = lower.find(term.lower())
            if idx >= 0:
                start = max(0, idx - 40)
                end = min(len(content), idx + len(term) + 40)
                snippet = content[start:end]
                if start > 0:
                    snippet = "…" + snippet
                if end < len(content):
                    snippet = snippet + "…"
                highlights.append(snippet)
        return highlights[:3]

    def traverse_graph(self, concept_id: int, depth: int = 2) -> Dict:
        """BFS knowledge graph traversal."""
        visited = set()
        nodes = []
        edges = []
        queue = [(concept_id, 0)]

        while queue:
            cid, d = queue.pop(0)
            if cid in visited or d > depth:
                continue
            visited.add(cid)
            concept = self.db.get(Concept, cid)
            if not concept:
                continue
            nodes.append({
                "id": concept.id,
                "name": concept.name,
                "mentions": concept.mention_count,
                "depth": d,
            })
            rels = self.db.query(ConceptRelationship).filter(
                or_(
                    ConceptRelationship.from_concept_id == cid,
                    ConceptRelationship.to_concept_id == cid,
                )
            ).all()
            for r in rels:
                other = r.to_concept_id if r.from_concept_id == cid else r.from_concept_id
                edges.append({
                    "from": r.from_concept_id,
                    "to": r.to_concept_id,
                    "type": r.relation_type.value,
                    "weight": r.weight,
                })
                if other not in visited:
                    queue.append((other, d + 1))

        return {"nodes": nodes, "edges": edges}
