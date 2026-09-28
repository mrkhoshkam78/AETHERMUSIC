# Knowledge Intelligence Engine (KIE)

**Offline-first Knowledge OS** — local knowledge base with real crawling, hybrid search, knowledge graph, and optional local AI.

## Architecture

```
knowledge-engine/
├── backend/          # FastAPI + SQLite + FTS5
│   └── app/
│       ├── api/      # REST endpoints
│       ├── crawler/  # Real website crawler (robots.txt, rate limit, incremental)
│       ├── ingestion/# Pipeline: parse → clean → chunk → index → concepts
│       ├── search/   # Hybrid: FTS + fuzzy + metadata + concept graph
│       ├── ai/       # Modular provider (none | ollama)
│       ├── models/   # Full schema
│       └── services/ # Source manager
├── frontend/         # Knowledge OS UI (vanilla JS, no build step)
└── data/             # Local SQLite, uploads, exports, chroma
```

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

API docs: http://localhost:8000/docs

## Core Capabilities

| Feature | Status |
|---------|--------|
| Website crawler (depth, rate limit, robots.txt) | ✅ Real |
| Incremental crawl (hash / ETag) | ✅ |
| PDF / DOCX / TXT / MD / CSV / JSON import | ✅ |
| Manual text ingestion | ✅ |
| Hybrid search (FTS5 + fuzzy + concepts) | ✅ |
| Knowledge Graph (concepts + relations) | ✅ |
| Hierarchical categories + tags | ✅ |
| RAG with anti-hallucination (optional Ollama) | ✅ |
| Source traceability | ✅ |
| Pause / Resume / Cancel crawl | ✅ |
| Backup / Restore (ZIP) | ✅ |
| Offline after ingestion | ✅ |
| Quality center | ✅ |
| Version history per source | ✅ |

## Offline Guarantee

After data is ingested:
- Search works without internet
- Browse / Explorer / Graph work offline
- AI answers work if local Ollama is running
- Internet is only needed to crawl/refresh remote sources

## Optional Local AI

```bash
# Install Ollama, pull a model
ollama pull llama3.2

# In backend .env or config:
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

Without AI, Explain/Research modes fall back to extractive summaries from the Knowledge Base.

## API Highlights

- `POST /api/import/url` — start website crawl
- `POST /api/import/file` — upload & index document
- `POST /api/import/text` — ingest note
- `POST /api/search` — hybrid search + optional answer modes
- `GET  /api/graph` — knowledge graph
- `POST /api/backup` — export full KB

## Design Principles

1. **AI is optional** — core search/browse never depends on LLM
2. **Local-first** — SQLite + FTS5 + local files
3. **Source truth** — every answer links back to documents
4. **No permanent mocks** — crawler, pipeline, search are real
5. **Incremental** — re-crawl only updates changed content
