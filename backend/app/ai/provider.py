"""Modular Local AI Provider - optional, system works fully without it."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from app.core.config import get_settings

settings = get_settings()


@dataclass
class AIResponse:
    text: str
    sources_used: List[int]  # document ids
    confidence: float = 0.0
    model: str = ""
    error: Optional[str] = None


class BaseAIProvider(ABC):
    @abstractmethod
    async def is_available(self) -> bool:
        ...

    @abstractmethod
    async def generate(self, prompt: str, context: str = "", max_tokens: int = 1024) -> AIResponse:
        ...

    @abstractmethod
    async def expand_query(self, query: str) -> List[str]:
        ...

    @abstractmethod
    async def summarize(self, text: str, max_length: int = 300) -> str:
        ...

    @abstractmethod
    async def extract_concepts(self, text: str) -> List[str]:
        ...


class NoneProvider(BaseAIProvider):
    """No-op provider - system works without AI."""

    async def is_available(self) -> bool:
        return False

    async def generate(self, prompt: str, context: str = "", max_tokens: int = 1024) -> AIResponse:
        return AIResponse(
            text="AI is not enabled. Showing search results only. Enable a local LLM (e.g. Ollama) in Settings for answer generation.",
            sources_used=[],
            confidence=0.0,
            model="none",
            error="AI_DISABLED",
        )

    async def expand_query(self, query: str) -> List[str]:
        return []

    async def summarize(self, text: str, max_length: int = 300) -> str:
        # extractive summary
        sentences = text.replace("\n", " ").split(". ")
        return ". ".join(sentences[:3])[:max_length]

    async def extract_concepts(self, text: str) -> List[str]:
        return []


class OllamaProvider(BaseAIProvider):
    """Local Ollama integration."""

    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model or settings.OLLAMA_MODEL

    async def is_available(self) -> bool:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str, context: str = "", max_tokens: int = 1024) -> AIResponse:
        import httpx
        system = (
            "You are a knowledge assistant. Answer ONLY based on the provided context. "
            "If the context does not contain enough information, say so clearly. "
            "Never invent facts. Cite sources by their numbers when possible."
        )
        full_prompt = f"Context:\n{context}\n\nQuestion: {prompt}\n\nAnswer based only on the context above:"
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": full_prompt,
                        "system": system,
                        "stream": False,
                        "options": {"num_predict": max_tokens, "temperature": 0.2},
                    },
                )
                if r.status_code != 200:
                    return AIResponse(text="", sources_used=[], error=f"Ollama HTTP {r.status_code}")
                data = r.json()
                return AIResponse(
                    text=data.get("response", ""),
                    sources_used=[],
                    confidence=0.7,
                    model=self.model,
                )
        except Exception as e:
            return AIResponse(text="", sources_used=[], error=str(e), model=self.model)

    async def expand_query(self, query: str) -> List[str]:
        resp = await self.generate(
            f"List 5 related search terms for: {query}. Reply only with comma-separated terms.",
            max_tokens=100,
        )
        if resp.error:
            return []
        return [t.strip() for t in resp.text.split(",") if t.strip()][:8]

    async def summarize(self, text: str, max_length: int = 300) -> str:
        resp = await self.generate(
            f"Summarize in under {max_length} characters:\n\n{text[:3000]}",
            max_tokens=200,
        )
        return resp.text if not resp.error else text[:max_length]

    async def extract_concepts(self, text: str) -> List[str]:
        resp = await self.generate(
            f"Extract key concepts as comma-separated list:\n\n{text[:2000]}",
            max_tokens=150,
        )
        if resp.error:
            return []
        return [t.strip() for t in resp.text.split(",") if t.strip()][:15]


def get_ai_provider() -> BaseAIProvider:
    if not settings.AI_ENABLED or settings.AI_PROVIDER == "none":
        return NoneProvider()
    if settings.AI_PROVIDER == "ollama":
        return OllamaProvider()
    return NoneProvider()


class RAGPipeline:
    """Retrieval-Augmented Generation with anti-hallucination guards."""

    def __init__(self, search_engine, ai_provider: BaseAIProvider = None):
        self.search = search_engine
        self.ai = ai_provider or get_ai_provider()

    async def answer(
        self,
        query: str,
        mode: str = "explain",  # search | explain | research
        limit: int = 8,
        **search_kwargs,
    ) -> Dict[str, Any]:
        # Always retrieve first
        results = self.search.search(query, limit=limit, **search_kwargs)

        if mode == "search":
            return {
                "mode": "search",
                "answer": None,
                "results": results,
                "ai_available": await self.ai.is_available(),
            }

        if not results.hits:
            return {
                "mode": mode,
                "answer": "No relevant information found in the Knowledge Base for this query. "
                          "Try different terms or add more sources.",
                "results": results,
                "sources": [],
                "sufficient_data": False,
                "ai_available": await self.ai.is_available(),
            }

        # Build context from retrieved chunks
        context_parts = []
        source_ids = []
        for i, hit in enumerate(results.hits[:limit], 1):
            context_parts.append(
                f"[{i}] Title: {hit.title}\nSource: {hit.source_name}\nURL: {hit.url or 'N/A'}\n"
                f"Content: {hit.content}\n"
            )
            source_ids.append(hit.document_id)

        context = "\n---\n".join(context_parts)

        if mode == "explain":
            prompt = (
                f"Based on the sources below, explain the answer to: {query}\n"
                "Be concise. If sources are insufficient, say so."
            )
        else:  # research
            prompt = (
                f"Research report on: {query}\n"
                "Structure: 1) Summary 2) Key Findings (with source numbers) "
                "3) Related Concepts 4) Gaps in available data.\n"
                "Only use provided sources. Do not invent information."
            )

        ai_available = await self.ai.is_available()
        if not ai_available:
            # Extractive fallback
            answer = self._extractive_answer(query, results.hits)
            return {
                "mode": mode,
                "answer": answer,
                "results": results,
                "sources": [
                    {
                        "index": i,
                        "document_id": h.document_id,
                        "title": h.title,
                        "url": h.url,
                        "source_name": h.source_name,
                        "snippet": h.content[:200],
                    }
                    for i, h in enumerate(results.hits[:limit], 1)
                ],
                "sufficient_data": True,
                "ai_available": False,
                "note": "AI unavailable — showing extractive summary from Knowledge Base.",
            }

        ai_resp = await self.ai.generate(prompt, context=context)
        ai_resp.sources_used = source_ids

        # Guard: if model admits no info or returns empty
        insufficient = (
            not ai_resp.text
            or any(phrase in ai_resp.text.lower() for phrase in (
                "do not contain", "not enough information", "insufficient",
                "cannot answer", "no relevant", "not found in",
            ))
        )

        return {
            "mode": mode,
            "answer": ai_resp.text,
            "results": results,
            "sources": [
                {
                    "index": i,
                    "document_id": h.document_id,
                    "title": h.title,
                    "url": h.url,
                    "source_name": h.source_name,
                    "snippet": h.content[:200],
                    "reason": h.reason,
                }
                for i, h in enumerate(results.hits[:limit], 1)
            ],
            "sufficient_data": not insufficient,
            "ai_available": True,
            "model": ai_resp.model,
            "error": ai_resp.error,
        }

    def _extractive_answer(self, query: str, hits: list) -> str:
        parts = [f"**Results for:** {query}\n"]
        for i, h in enumerate(hits[:5], 1):
            parts.append(f"**[{i}] {h.title}** ({h.source_name})")
            parts.append(f"{h.content[:300]}…")
            if h.reason:
                parts.append(f"_Match reason: {h.reason}_")
            parts.append("")
        return "\n".join(parts)
