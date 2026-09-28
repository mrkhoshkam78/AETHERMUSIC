"""Complete database schema for Knowledge Intelligence Engine."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime, ForeignKey,
    UniqueConstraint, Index, JSON, Enum as SAEnum, LargeBinary
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class SourceType(str, enum.Enum):
    WEBSITE = "website"
    SITEMAP = "sitemap"
    PDF = "pdf"
    TXT = "txt"
    DOCX = "docx"
    CSV = "csv"
    JSON = "json"
    HTML = "html"
    MARKDOWN = "markdown"
    RSS = "rss"
    API = "api"
    TEXT = "text"
    MANUAL = "manual"


class SourceStatus(str, enum.Enum):
    PENDING = "pending"
    CRAWLING = "crawling"
    INDEXING = "indexing"
    READY = "ready"
    PAUSED = "paused"
    FAILED = "failed"
    OUTDATED = "outdated"


class CrawlJobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ContentType(str, enum.Enum):
    WEBPAGE = "webpage"
    DOCUMENT = "document"
    NOTE = "note"
    FEED_ITEM = "feed_item"
    API_RESPONSE = "api_response"


class RelationType(str, enum.Enum):
    RELATED_TO = "related_to"
    PART_OF = "part_of"
    DEPENDS_ON = "depends_on"
    IS_A = "is_a"
    MENTIONS = "mentions"
    CONTRADICTS = "contradicts"
    SUPPORTS = "supports"
    DERIVED_FROM = "derived_from"


class QualityIssueType(str, enum.Enum):
    DUPLICATE = "duplicate"
    EMPTY = "empty"
    BROKEN_ENCODING = "broken_encoding"
    TOO_SHORT = "too_short"
    INVALID_SOURCE = "invalid_source"
    OUTDATED = "outdated"
    CONFLICTING = "conflicting"
    BROKEN_LINK = "broken_link"


# ─── Sources ─────────────────────────────────────────────────────────────────

class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True, index=True)
    source_type: Mapped[SourceType] = mapped_column(SAEnum(SourceType), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    status: Mapped[SourceStatus] = mapped_column(SAEnum(SourceStatus), default=SourceStatus.PENDING)
    crawl_depth: Mapped[int] = mapped_column(Integer, default=2)
    max_pages: Mapped[int] = mapped_column(Integer, default=50)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    etag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_modified: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_crawled: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    file_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="sources")
    documents: Mapped[List["Document"]] = relationship("Document", back_populates="source", cascade="all, delete-orphan")
    crawl_jobs: Mapped[List["CrawlJob"]] = relationship("CrawlJob", back_populates="source", cascade="all, delete-orphan")
    versions: Mapped[List["SourceVersion"]] = relationship("SourceVersion", back_populates="source", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sources_status_type", "status", "source_type"),
    )


class SourceVersion(Base):
    __tablename__ = "source_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64))
    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    snapshot_meta: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source: Mapped["Source"] = relationship("Source", back_populates="versions")

    __table_args__ = (
        UniqueConstraint("source_id", "version", name="uq_source_version"),
    )


# ─── Documents & Chunks ──────────────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True, index=True)
    content_type: Mapped[ContentType] = mapped_column(SAEnum(ContentType), default=ContentType.WEBPAGE)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    language: Mapped[Optional[str]] = mapped_column(String(20), default="en")
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_of_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    quality_score: Mapped[float] = mapped_column(Float, default=1.0)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    source: Mapped["Source"] = relationship("Source", back_populates="documents")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="documents")
    chunks: Mapped[List["Chunk"]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    concepts: Mapped[List["DocumentConcept"]] = relationship("DocumentConcept", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source_id", "content_hash", name="uq_doc_source_hash"),
        Index("ix_documents_title", "title"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    start_char: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_char: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    heading: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # chroma id
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_chunk_doc_index"),
        Index("ix_chunks_hash", "content_hash"),
    )


# ─── Taxonomy ────────────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)  # e.g. Science/Physics/Quantum
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side=[id], back_populates="children")
    children: Mapped[List["Category"]] = relationship("Category", back_populates="parent")
    sources: Mapped[List["Source"]] = relationship("Source", back_populates="category")
    documents: Mapped[List["Document"]] = relationship("Document", back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Knowledge Graph ─────────────────────────────────────────────────────────

class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    mention_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    relationships_from: Mapped[List["ConceptRelationship"]] = relationship(
        "ConceptRelationship", foreign_keys="ConceptRelationship.from_concept_id", back_populates="from_concept"
    )
    relationships_to: Mapped[List["ConceptRelationship"]] = relationship(
        "ConceptRelationship", foreign_keys="ConceptRelationship.to_concept_id", back_populates="to_concept"
    )
    documents: Mapped[List["DocumentConcept"]] = relationship("DocumentConcept", back_populates="concept")

    __table_args__ = (
        Index("ix_concepts_name", "name"),
    )


class ConceptRelationship(Base):
    __tablename__ = "concept_relationships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    to_concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    relation_type: Mapped[RelationType] = mapped_column(SAEnum(RelationType), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    from_concept: Mapped["Concept"] = relationship("Concept", foreign_keys=[from_concept_id], back_populates="relationships_from")
    to_concept: Mapped["Concept"] = relationship("Concept", foreign_keys=[to_concept_id], back_populates="relationships_to")

    __table_args__ = (
        UniqueConstraint("from_concept_id", "to_concept_id", "relation_type", name="uq_concept_rel"),
        Index("ix_concept_rel_from", "from_concept_id"),
        Index("ix_concept_rel_to", "to_concept_id"),
    )


class DocumentConcept(Base):
    __tablename__ = "document_concepts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    relevance: Mapped[float] = mapped_column(Float, default=1.0)
    mentions: Mapped[int] = mapped_column(Integer, default=1)

    document: Mapped["Document"] = relationship("Document", back_populates="concepts")
    concept: Mapped["Concept"] = relationship("Concept", back_populates="documents")

    __table_args__ = (
        UniqueConstraint("document_id", "concept_id", name="uq_doc_concept"),
    )


# ─── Crawl Jobs ──────────────────────────────────────────────────────────────

class CrawlJob(Base):
    __tablename__ = "crawl_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[CrawlJobStatus] = mapped_column(SAEnum(CrawlJobStatus), default=CrawlJobStatus.QUEUED)
    depth: Mapped[int] = mapped_column(Integer, default=2)
    max_pages: Mapped[int] = mapped_column(Integer, default=50)
    pages_found: Mapped[int] = mapped_column(Integer, default=0)
    pages_crawled: Mapped[int] = mapped_column(Integer, default=0)
    pages_failed: Mapped[int] = mapped_column(Integer, default=0)
    pages_skipped: Mapped[int] = mapped_column(Integer, default=0)
    current_url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    error_log: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source: Mapped["Source"] = relationship("Source", back_populates="crawl_jobs")


# ─── Search & Activity ───────────────────────────────────────────────────────

class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(String(1000), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="search")  # search | explain | research
    filters: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # document | concept | source
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_favorite"),
    )


class QualityIssue(Base):
    __tablename__ = "quality_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_type: Mapped[QualityIssueType] = mapped_column(SAEnum(QualityIssueType), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="warning")  # info | warning | error
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    details: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
