"""FastAPI routes for Knowledge Intelligence Engine."""
from __future__ import annotations

import asyncio
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.config import get_settings
from app.models.entities import (
    Source, Document, Chunk, Category, Concept, ConceptRelationship,
    CrawlJob, SearchHistory, Favorite, QualityIssue, SourceType, SourceStatus,
)
from app.services.source_service import SourceService
from app.search.hybrid import HybridSearch
from app.ai.provider import RAGPipeline, get_ai_provider

settings = get_settings()
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SourceCreate(BaseModel):
    name: str
    source_type: str
    url: Optional[str] = None
    category_id: Optional[int] = None
    tags: List[str] = []
    crawl_depth: int = 2
    max_pages: int = 50


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    category_id: Optional[int] = None
    crawl_depth: Optional[int] = None
    max_pages: Optional[int] = None
    status: Optional[str] = None


class TextIngest(BaseModel):
    title: str
    content: str
    tags: List[str] = []


class SearchRequest(BaseModel):
    query: str
    mode: str = "hybrid"  # hybrid | keyword | semantic | exact
    answer_mode: str = "search"  # search | explain | research
    limit: int = 20
    offset: int = 0
    category_id: Optional[int] = None
    source_id: Optional[int] = None
    tags: Optional[List[str]] = None


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class ConceptRelationCreate(BaseModel):
    from_concept_id: int
    to_concept_id: int
    relation_type: str = "related_to"
    weight: float = 1.0
    evidence: Optional[str] = None


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    svc = SourceService(db)
    return svc.get_dashboard_stats()


# ─── Sources ─────────────────────────────────────────────────────────────────

@router.get("/sources")
def list_sources(
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    svc = SourceService(db)
    sources = svc.list_sources(status, source_type, limit, offset)
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "source_type": s.source_type.value,
            "status": s.status.value,
            "tags": s.tags,
            "document_count": s.document_count,
            "chunk_count": s.chunk_count,
            "version": s.version,
            "last_crawled": s.last_crawled.isoformat() if s.last_crawled else None,
            "last_updated": s.last_updated.isoformat() if s.last_updated else None,
            "error_message": s.error_message,
            "crawl_depth": s.crawl_depth,
            "max_pages": s.max_pages,
        }
        for s in sources
    ]


@router.post("/sources")
def create_source(body: SourceCreate, db: Session = Depends(get_db)):
    try:
        st = SourceType(body.source_type)
    except ValueError:
        raise HTTPException(400, f"Invalid source_type: {body.source_type}")
    svc = SourceService(db)
    source = svc.create_source(
        name=body.name,
        source_type=st,
        url=body.url,
        category_id=body.category_id,
        tags=body.tags,
        crawl_depth=body.crawl_depth,
        max_pages=body.max_pages,
    )
    return {"id": source.id, "name": source.name, "status": source.status.value}


@router.get("/sources/{source_id}")
def get_source(source_id: int, db: Session = Depends(get_db)):
    svc = SourceService(db)
    s = svc.get_source(source_id)
    if not s:
        raise HTTPException(404, "Source not found")
    jobs = db.query(CrawlJob).filter(CrawlJob.source_id == source_id).order_by(CrawlJob.id.desc()).limit(5).all()
    return {
        "id": s.id,
        "name": s.name,
        "url": s.url,
        "source_type": s.source_type.value,
        "status": s.status.value,
        "tags": s.tags,
        "document_count": s.document_count,
        "chunk_count": s.chunk_count,
        "version": s.version,
        "last_crawled": s.last_crawled.isoformat() if s.last_crawled else None,
        "error_message": s.error_message,
        "metadata": s.metadata_,
        "recent_jobs": [
            {
                "id": j.id,
                "status": j.status.value,
                "pages_crawled": j.pages_crawled,
                "pages_failed": j.pages_failed,
                "pages_skipped": j.pages_skipped,
                "current_url": j.current_url,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            }
            for j in jobs
        ],
    }


@router.patch("/sources/{source_id}")
def update_source(source_id: int, body: SourceUpdate, db: Session = Depends(get_db)):
    svc = SourceService(db)
    s = svc.update_source(source_id, **body.model_dump(exclude_none=True))
    if not s:
        raise HTTPException(404)
    return {"id": s.id, "status": s.status.value}


@router.delete("/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    svc = SourceService(db)
    if not svc.delete_source(source_id):
        raise HTTPException(404)
    return {"ok": True}


@router.post("/sources/{source_id}/crawl")
async def start_crawl(
    source_id: int,
    background_tasks: BackgroundTasks,
    force_full: bool = False,
    db: Session = Depends(get_db),
):
    svc = SourceService(db)
    source = svc.get_source(source_id)
    if not source:
        raise HTTPException(404)
    if source.status == SourceStatus.CRAWLING:
        raise HTTPException(409, "Already crawling")

    async def run():
        db2 = next(get_db())
        try:
            svc2 = SourceService(db2)
            await svc2.crawl_website(source_id, force_full=force_full)
        finally:
            db2.close()

    background_tasks.add_task(lambda: asyncio.run(run()))
    return {"message": "Crawl started", "source_id": source_id}


@router.post("/sources/{source_id}/pause")
def pause_source(source_id: int, db: Session = Depends(get_db)):
    svc = SourceService(db)
    if not svc.pause_source(source_id):
        raise HTTPException(404)
    return {"ok": True, "status": "paused"}


@router.post("/sources/{source_id}/resume")
def resume_source(source_id: int, db: Session = Depends(get_db)):
    svc = SourceService(db)
    if not svc.resume_source(source_id):
        raise HTTPException(404, "No active crawl to resume")
    return {"ok": True, "status": "resumed"}


@router.post("/sources/{source_id}/cancel")
def cancel_crawl(source_id: int, db: Session = Depends(get_db)):
    svc = SourceService(db)
    svc.cancel_crawl(source_id)
    return {"ok": True}


# ─── Import Center ───────────────────────────────────────────────────────────

@router.post("/import/file")
async def import_file(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    tags: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type not allowed: {ext}")

    # Save file
    dest = settings.UPLOAD_DIR / f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(400, "File too large")
    dest.write_bytes(content)

    type_map = {
        ".pdf": SourceType.PDF, ".txt": SourceType.TXT, ".docx": SourceType.DOCX,
        ".csv": SourceType.CSV, ".json": SourceType.JSON, ".html": SourceType.HTML,
        ".htm": SourceType.HTML, ".md": SourceType.MARKDOWN, ".markdown": SourceType.MARKDOWN,
    }
    st = type_map.get(ext, SourceType.TXT)
    svc = SourceService(db)
    source = svc.create_source(
        name=name or file.filename,
        source_type=st,
        file_path=str(dest),
        tags=[t.strip() for t in tags.split(",") if t.strip()],
    )
    result = await svc.ingest_file(source.id)
    return {"source_id": source.id, **result}


@router.post("/import/text")
async def import_text(body: TextIngest, db: Session = Depends(get_db)):
    svc = SourceService(db)
    source = svc.create_source(
        name=body.title,
        source_type=SourceType.TEXT,
        tags=body.tags,
    )
    result = await svc.ingest_text(source.id, body.title, body.content)
    return {"source_id": source.id, **result}


@router.post("/import/url")
async def import_url(
    body: SourceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not body.url:
        raise HTTPException(400, "URL required")
    try:
        st = SourceType(body.source_type) if body.source_type else SourceType.WEBSITE
    except ValueError:
        st = SourceType.WEBSITE
    svc = SourceService(db)
    source = svc.create_source(
        name=body.name or body.url,
        source_type=st,
        url=body.url,
        tags=body.tags,
        crawl_depth=body.crawl_depth,
        max_pages=body.max_pages,
        category_id=body.category_id,
    )

    async def run():
        db2 = next(get_db())
        try:
            await SourceService(db2).crawl_website(source.id)
        finally:
            db2.close()

    background_tasks.add_task(lambda: asyncio.run(run()))
    return {"source_id": source.id, "status": "crawling", "message": "Crawl started in background"}


# ─── Search ──────────────────────────────────────────────────────────────────

@router.post("/search")
async def search(body: SearchRequest, db: Session = Depends(get_db)):
    engine = HybridSearch(db)
    rag = RAGPipeline(engine, get_ai_provider())

    # Log history
    hist = SearchHistory(query=body.query, mode=body.answer_mode, filters={
        "category_id": body.category_id, "source_id": body.source_id, "tags": body.tags,
    })
    db.add(hist)

    if body.answer_mode in ("explain", "research"):
        result = await rag.answer(
            body.query,
            mode=body.answer_mode,
            limit=body.limit,
            category_id=body.category_id,
            source_id=body.source_id,
            tags=body.tags,
            mode_search=body.mode,
        )
        # fix kwargs
        search_result = result["results"]
        hist.result_count = search_result.total
        db.commit()
        return {
            "mode": result["mode"],
            "answer": result.get("answer"),
            "sufficient_data": result.get("sufficient_data", True),
            "ai_available": result.get("ai_available"),
            "sources": result.get("sources", []),
            "query": search_result.query,
            "expanded_terms": search_result.expanded_terms,
            "total": search_result.total,
            "took_ms": search_result.took_ms,
            "concepts": search_result.concepts_found,
            "hits": [
                {
                    "document_id": h.document_id,
                    "chunk_id": h.chunk_id,
                    "title": h.title,
                    "content": h.content,
                    "url": h.url,
                    "score": round(h.score, 4),
                    "match_type": h.match_type,
                    "reason": h.reason,
                    "source_name": h.source_name,
                    "source_type": h.source_type,
                    "tags": h.tags,
                    "concepts": h.concepts,
                    "highlights": h.highlights,
                }
                for h in search_result.hits
            ],
            "note": result.get("note"),
        }

    results = engine.search(
        body.query,
        limit=body.limit,
        offset=body.offset,
        category_id=body.category_id,
        source_id=body.source_id,
        tags=body.tags,
        mode=body.mode,
    )
    hist.result_count = results.total
    db.commit()
    return {
        "mode": "search",
        "query": results.query,
        "expanded_terms": results.expanded_terms,
        "total": results.total,
        "took_ms": results.took_ms,
        "concepts": results.concepts_found,
        "hits": [
            {
                "document_id": h.document_id,
                "chunk_id": h.chunk_id,
                "title": h.title,
                "content": h.content,
                "url": h.url,
                "score": round(h.score, 4),
                "match_type": h.match_type,
                "reason": h.reason,
                "source_name": h.source_name,
                "source_type": h.source_type,
                "tags": h.tags,
                "concepts": h.concepts,
                "highlights": h.highlights,
            }
            for h in results.hits
        ],
    }


@router.get("/search/history")
def search_history(limit: int = 30, db: Session = Depends(get_db)):
    rows = db.query(SearchHistory).order_by(SearchHistory.id.desc()).limit(limit).all()
    return [
        {"id": r.id, "query": r.query, "mode": r.mode, "result_count": r.result_count,
         "is_saved": r.is_saved, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


# ─── Documents & Explorer ────────────────────────────────────────────────────

@router.get("/documents")
def list_documents(
    source_id: Optional[int] = None,
    category_id: Optional[int] = None,
    limit: int = 30,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Document).filter(Document.is_duplicate == False)
    if source_id:
        q = q.filter(Document.source_id == source_id)
    if category_id:
        q = q.filter(Document.category_id == category_id)
    total = q.count()
    docs = q.order_by(Document.updated_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "url": d.url,
                "source_id": d.source_id,
                "word_count": d.word_count,
                "tags": d.tags,
                "summary": d.summary,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ],
    }


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404)
    chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).order_by(Chunk.chunk_index).all()
    concepts = [
        {"id": dc.concept.id, "name": dc.concept.name, "relevance": dc.relevance}
        for dc in doc.concepts if dc.concept
    ]
    source = db.get(Source, doc.source_id)
    return {
        "id": doc.id,
        "title": doc.title,
        "url": doc.url,
        "content": doc.content,
        "summary": doc.summary,
        "tags": doc.tags,
        "word_count": doc.word_count,
        "source": {"id": source.id, "name": source.name, "type": source.source_type.value} if source else None,
        "concepts": concepts,
        "chunks": [
            {"id": c.id, "index": c.chunk_index, "content": c.content, "token_count": c.token_count}
            for c in chunks
        ],
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


# ─── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.path, Category.sort_order).all()
    return [
        {
            "id": c.id, "name": c.name, "slug": c.slug, "parent_id": c.parent_id,
            "path": c.path, "document_count": c.document_count, "icon": c.icon, "color": c.color,
        }
        for c in cats
    ]


@router.post("/categories")
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    from app.ingestion.pipeline import slugify
    slug = slugify(body.name)
    path = body.name
    if body.parent_id:
        parent = db.get(Category, body.parent_id)
        if parent:
            path = f"{parent.path}/{body.name}" if parent.path else f"{parent.name}/{body.name}"
    cat = Category(
        name=body.name, slug=slug, parent_id=body.parent_id,
        description=body.description, path=path, icon=body.icon, color=body.color,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "path": cat.path}


# ─── Knowledge Graph ─────────────────────────────────────────────────────────

@router.get("/concepts")
def list_concepts(limit: int = 50, q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Concept)
    if q:
        query = query.filter(Concept.name.ilike(f"%{q}%"))
    concepts = query.order_by(Concept.mention_count.desc()).limit(limit).all()
    return [
        {"id": c.id, "name": c.name, "slug": c.slug, "mention_count": c.mention_count, "aliases": c.aliases}
        for c in concepts
    ]


@router.get("/concepts/{concept_id}/graph")
def concept_graph(concept_id: int, depth: int = 2, db: Session = Depends(get_db)):
    engine = HybridSearch(db)
    return engine.traverse_graph(concept_id, depth)


@router.post("/concepts/relations")
def create_relation(body: ConceptRelationCreate, db: Session = Depends(get_db)):
    from app.models.entities import RelationType
    try:
        rt = RelationType(body.relation_type)
    except ValueError:
        raise HTTPException(400, "Invalid relation_type")
    rel = ConceptRelationship(
        from_concept_id=body.from_concept_id,
        to_concept_id=body.to_concept_id,
        relation_type=rt,
        weight=body.weight,
        evidence=body.evidence,
    )
    db.add(rel)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Relation already exists")
    return {"id": rel.id}


@router.get("/graph")
def full_graph(limit: int = 100, db: Session = Depends(get_db)):
    concepts = db.query(Concept).order_by(Concept.mention_count.desc()).limit(limit).all()
    ids = [c.id for c in concepts]
    rels = db.query(ConceptRelationship).filter(
        ConceptRelationship.from_concept_id.in_(ids),
        ConceptRelationship.to_concept_id.in_(ids),
    ).all() if ids else []
    return {
        "nodes": [{"id": c.id, "name": c.name, "mentions": c.mention_count} for c in concepts],
        "edges": [
            {"from": r.from_concept_id, "to": r.to_concept_id, "type": r.relation_type.value, "weight": r.weight}
            for r in rels
        ],
    }


# ─── Quality ─────────────────────────────────────────────────────────────────

@router.get("/quality")
def quality_issues(resolved: bool = False, db: Session = Depends(get_db)):
    issues = db.query(QualityIssue).filter(QualityIssue.resolved == resolved).order_by(QualityIssue.id.desc()).limit(100).all()
    return [
        {
            "id": i.id, "type": i.issue_type.value, "entity_type": i.entity_type,
            "entity_id": i.entity_id, "description": i.description,
            "severity": i.severity, "created_at": i.created_at.isoformat(),
        }
        for i in issues
    ]


# ─── Backup / Restore ────────────────────────────────────────────────────────

@router.post("/backup")
def create_backup(db: Session = Depends(get_db)):
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = settings.EXPORT_DIR / f"knowledge_backup_{ts}.zip"
    with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if settings.DB_PATH.exists():
            zf.write(settings.DB_PATH, "knowledge.db")
        uploads = settings.UPLOAD_DIR
        if uploads.exists():
            for f in uploads.rglob("*"):
                if f.is_file():
                    zf.write(f, f"uploads/{f.relative_to(uploads)}")
    return {"path": str(backup_path), "size": backup_path.stat().st_size}


@router.get("/backup/download/{filename}")
def download_backup(filename: str):
    path = settings.EXPORT_DIR / filename
    if not path.exists() or ".." in filename:
        raise HTTPException(404)
    return FileResponse(path, filename=filename)


# ─── Settings & AI status ────────────────────────────────────────────────────

@router.get("/ai/status")
async def ai_status():
    provider = get_ai_provider()
    available = await provider.is_available()
    return {
        "enabled": settings.AI_ENABLED,
        "provider": settings.AI_PROVIDER,
        "available": available,
        "model": settings.OLLAMA_MODEL if settings.AI_PROVIDER == "ollama" else None,
    }


@router.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION, "offline": True}
