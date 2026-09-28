"""Source Manager: Add / Edit / Refresh / Pause / Delete / Re-index."""
from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import (
    Source, Document, Chunk, CrawlJob, SourceVersion, ActivityLog,
    SourceType, SourceStatus, CrawlJobStatus, ContentType,
)
from app.crawler.engine import CrawlerEngine, PageResult
from app.ingestion.pipeline import IngestionPipeline, PARSERS
from app.db.base import SessionLocal

settings = get_settings()

# In-memory active crawlers for pause/resume/cancel
_active_crawlers: Dict[int, CrawlerEngine] = {}


class SourceService:
    def __init__(self, db: Session):
        self.db = db

    def list_sources(
        self,
        status: Optional[str] = None,
        source_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Source]:
        q = self.db.query(Source).filter(Source.is_active == True)
        if status:
            q = q.filter(Source.status == status)
        if source_type:
            q = q.filter(Source.source_type == source_type)
        return q.order_by(Source.updated_at.desc()).offset(offset).limit(limit).all()

    def get_source(self, source_id: int) -> Optional[Source]:
        return self.db.get(Source, source_id)

    def create_source(
        self,
        name: str,
        source_type: SourceType,
        url: Optional[str] = None,
        category_id: Optional[int] = None,
        tags: Optional[List[str]] = None,
        crawl_depth: int = 2,
        max_pages: int = 50,
        file_path: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> Source:
        source = Source(
            name=name,
            url=url,
            source_type=source_type,
            category_id=category_id,
            tags=tags or [],
            crawl_depth=crawl_depth,
            max_pages=max_pages,
            file_path=file_path,
            metadata_=metadata or {},
            status=SourceStatus.PENDING,
        )
        self.db.add(source)
        self.db.add(ActivityLog(action="source_created", entity_type="source", details={"name": name}))
        self.db.commit()
        self.db.refresh(source)
        return source

    def update_source(self, source_id: int, **kwargs) -> Optional[Source]:
        source = self.get_source(source_id)
        if not source:
            return None
        for k, v in kwargs.items():
            if hasattr(source, k) and v is not None:
                setattr(source, k, v)
        source.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(source)
        return source

    def delete_source(self, source_id: int) -> bool:
        source = self.get_source(source_id)
        if not source:
            return False
        # Soft delete + cascade handled by FK
        source.is_active = False
        source.status = SourceStatus.FAILED
        # Hard cleanup of FTS
        docs = self.db.query(Document).filter(Document.source_id == source_id).all()
        for doc in docs:
            self.db.execute(
                __import__("sqlalchemy").text("DELETE FROM documents_fts WHERE document_id = :id"),
                {"id": doc.id},
            )
            for ch in doc.chunks:
                self.db.execute(
                    __import__("sqlalchemy").text("DELETE FROM chunks_fts WHERE chunk_id = :id"),
                    {"id": ch.id},
                )
        self.db.query(Chunk).filter(Chunk.source_id == source_id).delete()
        self.db.query(Document).filter(Document.source_id == source_id).delete()
        self.db.delete(source)
        self.db.add(ActivityLog(action="source_deleted", entity_type="source", entity_id=source_id))
        self.db.commit()
        return True

    def pause_source(self, source_id: int) -> bool:
        source = self.get_source(source_id)
        if not source:
            return False
        source.status = SourceStatus.PAUSED
        if source_id in _active_crawlers:
            _active_crawlers[source_id].pause()
        job = self.db.query(CrawlJob).filter(
            CrawlJob.source_id == source_id,
            CrawlJob.status == CrawlJobStatus.RUNNING,
        ).first()
        if job:
            job.status = CrawlJobStatus.PAUSED
        self.db.commit()
        return True

    def resume_source(self, source_id: int) -> bool:
        source = self.get_source(source_id)
        if not source:
            return False
        if source_id in _active_crawlers:
            _active_crawlers[source_id].resume()
            source.status = SourceStatus.CRAWLING
            job = self.db.query(CrawlJob).filter(
                CrawlJob.source_id == source_id,
                CrawlJob.status == CrawlJobStatus.PAUSED,
            ).first()
            if job:
                job.status = CrawlJobStatus.RUNNING
            self.db.commit()
            return True
        # re-trigger crawl
        return False

    def cancel_crawl(self, source_id: int) -> bool:
        if source_id in _active_crawlers:
            _active_crawlers[source_id].cancel()
            return True
        return False

    async def crawl_website(self, source_id: int, force_full: bool = False) -> CrawlJob:
        source = self.get_source(source_id)
        if not source or not source.url:
            raise ValueError("Source not found or has no URL")

        job = CrawlJob(
            source_id=source_id,
            status=CrawlJobStatus.RUNNING,
            depth=source.crawl_depth,
            max_pages=source.max_pages,
            started_at=datetime.utcnow(),
        )
        self.db.add(job)
        source.status = SourceStatus.CRAWLING
        self.db.commit()
        self.db.refresh(job)

        # Known hashes for incremental
        known_hashes = set()
        known_urls = set()
        existing_etags = {}
        if not force_full:
            docs = self.db.query(Document).filter(Document.source_id == source_id).all()
            for d in docs:
                known_hashes.add(d.content_hash)
                if d.url:
                    known_urls.add(d.url)
                    if d.metadata_ and d.metadata_.get("etag"):
                        existing_etags[d.url] = d.metadata_["etag"]

        def on_progress(prog):
            db = SessionLocal()
            try:
                j = db.get(CrawlJob, job.id)
                if j:
                    j.pages_found = prog.pages_found
                    j.pages_crawled = prog.pages_crawled
                    j.pages_failed = prog.pages_failed
                    j.pages_skipped = prog.pages_skipped
                    j.current_url = prog.current_url
                    j.error_log = prog.errors[-20:]
                    j.status = CrawlJobStatus(prog.status) if prog.status in [s.value for s in CrawlJobStatus] else j.status
                    db.commit()
            finally:
                db.close()

        crawler = CrawlerEngine(on_progress=on_progress)
        crawler.set_known(known_hashes, known_urls)
        _active_crawlers[source_id] = crawler

        try:
            pages = await crawler.crawl(
                start_url=source.url,
                job_id=job.id,
                depth=source.crawl_depth,
                max_pages=source.max_pages,
                existing_etags=existing_etags,
            )

            # Ingest new pages
            pipeline = IngestionPipeline(self.db)
            new_count = 0
            for page in pages:
                if page.error or page.is_duplicate or not page.content:
                    continue
                result = pipeline.process(
                    source=source,
                    title=page.title,
                    content=page.content,
                    url=page.url,
                    content_type=ContentType.WEBPAGE,
                    metadata={
                        "etag": page.etag,
                        "last_modified": page.last_modified,
                        "headings": page.headings,
                        **page.metadata,
                    },
                )
                if result.success and not result.is_duplicate:
                    new_count += 1

            # Version if changes
            if new_count > 0:
                source.version += 1
                self.db.add(SourceVersion(
                    source_id=source.id,
                    version=source.version,
                    content_hash=source.content_hash,
                    change_summary=f"{new_count} new/updated pages",
                ))

            source.last_crawled = datetime.utcnow()
            source.status = SourceStatus.READY if new_count >= 0 else SourceStatus.FAILED
            job.status = CrawlJobStatus.COMPLETED
            job.finished_at = datetime.utcnow()
            job.pages_crawled = new_count
            self.db.commit()

        except Exception as e:
            source.status = SourceStatus.FAILED
            source.error_message = str(e)[:500]
            job.status = CrawlJobStatus.FAILED
            job.error_log = (job.error_log or []) + [str(e)]
            job.finished_at = datetime.utcnow()
            self.db.commit()
            raise
        finally:
            _active_crawlers.pop(source_id, None)

        self.db.refresh(job)
        return job

    async def ingest_file(self, source_id: int) -> Dict[str, Any]:
        source = self.get_source(source_id)
        if not source or not source.file_path:
            raise ValueError("Source has no file")

        path = Path(source.file_path)
        if not path.exists():
            raise FileNotFoundError(str(path))

        ext = path.suffix.lower()
        parser = PARSERS.get(ext)
        if not parser:
            raise ValueError(f"Unsupported file type: {ext}")

        source.status = SourceStatus.INDEXING
        self.db.commit()

        title, content = parser(path)
        pipeline = IngestionPipeline(self.db)
        result = pipeline.process(
            source=source,
            title=title,
            content=content,
            content_type=ContentType.DOCUMENT,
            metadata={"filename": path.name, "size": path.stat().st_size},
        )
        return {
            "success": result.success,
            "document_id": result.document_id,
            "chunk_count": result.chunk_count,
            "concept_count": result.concept_count,
            "is_duplicate": result.is_duplicate,
            "steps": [{"name": s.name, "status": s.status, "message": s.message} for s in result.steps],
        }

    async def ingest_text(self, source_id: int, title: str, content: str) -> Dict[str, Any]:
        source = self.get_source(source_id)
        if not source:
            raise ValueError("Source not found")
        pipeline = IngestionPipeline(self.db)
        result = pipeline.process(
            source=source,
            title=title,
            content=content,
            content_type=ContentType.NOTE,
        )
        return {
            "success": result.success,
            "document_id": result.document_id,
            "chunk_count": result.chunk_count,
            "steps": [{"name": s.name, "status": s.status, "message": s.message} for s in result.steps],
        }

    def get_dashboard_stats(self) -> Dict[str, Any]:
        from app.models.entities import Category, Concept, QualityIssue
        total_sources = self.db.query(Source).filter(Source.is_active == True).count()
        total_docs = self.db.query(Document).count()
        total_chunks = self.db.query(Chunk).count()
        total_cats = self.db.query(Category).count()
        total_concepts = self.db.query(Concept).count()
        failed = self.db.query(Source).filter(Source.status == SourceStatus.FAILED).count()
        quality = self.db.query(QualityIssue).filter(QualityIssue.resolved == False).count()

        db_size = 0
        if settings.DB_PATH.exists():
            db_size = settings.DB_PATH.stat().st_size

        last_crawl = self.db.query(Source).filter(
            Source.last_crawled.isnot(None)
        ).order_by(Source.last_crawled.desc()).first()

        return {
            "total_sources": total_sources,
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_categories": total_cats,
            "total_concepts": total_concepts,
            "failed_sources": failed,
            "quality_issues": quality,
            "database_size_bytes": db_size,
            "last_crawl": last_crawl.last_crawled.isoformat() if last_crawl and last_crawl.last_crawled else None,
            "index_status": "ready",
        }
