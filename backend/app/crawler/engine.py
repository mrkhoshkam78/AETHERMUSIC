"""Real website crawler with robots.txt, rate limiting, incremental support."""
from __future__ import annotations

import asyncio
import hashlib
import re
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Set, List, Dict, Callable, Any
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

from app.core.config import get_settings

settings = get_settings()


@dataclass
class PageResult:
    url: str
    title: str = ""
    content: str = ""
    headings: List[str] = field(default_factory=list)
    links: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    content_hash: str = ""
    etag: Optional[str] = None
    last_modified: Optional[str] = None
    status_code: int = 0
    error: Optional[str] = None
    is_duplicate: bool = False
    word_count: int = 0


@dataclass
class CrawlProgress:
    job_id: int
    status: str
    pages_found: int = 0
    pages_crawled: int = 0
    pages_failed: int = 0
    pages_skipped: int = 0
    current_url: str = ""
    errors: List[str] = field(default_factory=list)


class RobotsChecker:
    def __init__(self, user_agent: str):
        self.user_agent = user_agent
        self._cache: Dict[str, RobotFileParser] = {}

    async def can_fetch(self, client: httpx.AsyncClient, url: str) -> bool:
        if not settings.CRAWL_RESPECT_ROBOTS:
            return True
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        if base not in self._cache:
            rp = RobotFileParser()
            robots_url = f"{base}/robots.txt"
            try:
                resp = await client.get(robots_url, timeout=10)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                else:
                    rp.parse([])  # allow all if no robots
            except Exception:
                rp.parse([])
            self._cache[base] = rp
        return self._cache[base].can_fetch(self.user_agent, url)


def normalize_url(url: str, base: Optional[str] = None) -> str:
    if base:
        url = urljoin(base, url)
    url, _ = urldefrag(url)
    parsed = urlparse(url)
    # strip tracking params
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc.lower()}{path}"


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def extract_main_content(html: str, url: str) -> tuple[str, str, List[str], Dict]:
    """Extract title, main text, headings, metadata. Prefer trafilatura."""
    title = ""
    content = ""
    headings: List[str] = []
    meta: Dict[str, Any] = {}

    if HAS_TRAFILATURA:
        extracted = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=True,
            output_format="txt",
            url=url,
        )
        meta_data = trafilatura.extract_metadata(html)
        if meta_data:
            title = meta_data.title or ""
            meta = {
                "author": meta_data.author,
                "date": meta_data.date,
                "description": meta_data.description,
                "sitename": meta_data.sitename,
            }
        content = extracted or ""

    soup = BeautifulSoup(html, "lxml")

    if not title:
        t = soup.find("title")
        title = t.get_text(strip=True) if t else ""
        h1 = soup.find("h1")
        if h1 and not title:
            title = h1.get_text(strip=True)

    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = tag.get_text(strip=True)
        if text and len(text) < 300:
            headings.append(text)

    if not content:
        # Fallback: remove nav/footer/script and get body text
        for sel in ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"]:
            for el in soup.find_all(sel):
                el.decompose()
        body = soup.find("body") or soup
        content = body.get_text(separator="\n", strip=True)
        # collapse whitespace
        content = re.sub(r"\n{3,}", "\n\n", content)
        content = re.sub(r"[ \t]{2,}", " ", content)

    # Meta tags
    for m in soup.find_all("meta"):
        name = m.get("name") or m.get("property") or ""
        if name.lower() in ("description", "og:description", "keywords", "og:title"):
            meta[name.lower()] = m.get("content", "")

    return title, content.strip(), headings, meta


def extract_links(html: str, base_url: str, same_domain: bool = True) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc.lower()
    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        full = normalize_url(href, base_url)
        if full in seen:
            continue
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            continue
        if same_domain and parsed.netloc.lower() != base_domain:
            continue
        # skip binary/common non-html
        path_lower = parsed.path.lower()
        if any(path_lower.endswith(ext) for ext in (
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".zip", ".mp4",
            ".mp3", ".css", ".js", ".woff", ".ico", ".xml"
        )):
            continue
        seen.add(full)
        links.append(full)
    return links


class CrawlerEngine:
    """Async crawler with pause/resume/cancel, rate limiting, incremental."""

    def __init__(
        self,
        on_progress: Optional[Callable[[CrawlProgress], None]] = None,
        on_page: Optional[Callable[[PageResult], None]] = None,
    ):
        self.on_progress = on_progress
        self.on_page = on_page
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # not paused
        self._cancel = False
        self.robots = RobotsChecker(settings.CRAWL_USER_AGENT)
        self._known_hashes: Set[str] = set()
        self._known_urls: Set[str] = set()

    def pause(self):
        self._pause_event.clear()

    def resume(self):
        self._pause_event.set()

    def cancel(self):
        self._cancel = True
        self._pause_event.set()

    def set_known(self, hashes: Set[str], urls: Set[str]):
        self._known_hashes = hashes
        self._known_urls = urls

    async def crawl(
        self,
        start_url: str,
        job_id: int = 0,
        depth: int = 2,
        max_pages: int = 50,
        existing_etags: Optional[Dict[str, str]] = None,
    ) -> List[PageResult]:
        existing_etags = existing_etags or {}
        results: List[PageResult] = []
        visited: Set[str] = set()
        queue: deque = deque([(normalize_url(start_url), 0)])  # (url, depth)
        progress = CrawlProgress(job_id=job_id, status="running")

        headers = {
            "User-Agent": settings.CRAWL_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
        }

        async with httpx.AsyncClient(
            headers=headers,
            follow_redirects=True,
            timeout=settings.CRAWL_TIMEOUT,
            limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
        ) as client:
            while queue and len(results) < max_pages:
                if self._cancel:
                    progress.status = "cancelled"
                    break

                await self._pause_event.wait()

                url, current_depth = queue.popleft()
                if url in visited:
                    continue
                visited.add(url)
                progress.current_url = url
                progress.pages_found = len(visited) + len(queue)

                # robots
                if not await self.robots.can_fetch(client, url):
                    progress.pages_skipped += 1
                    progress.errors.append(f"robots.txt disallowed: {url}")
                    self._emit(progress)
                    continue

                # incremental: skip known URL if unchanged
                req_headers = {}
                if url in existing_etags:
                    req_headers["If-None-Match"] = existing_etags[url]

                try:
                    await asyncio.sleep(settings.CRAWL_RATE_LIMIT_DELAY)
                    resp = await client.get(url, headers=req_headers)

                    if resp.status_code == 304:
                        progress.pages_skipped += 1
                        self._emit(progress)
                        continue

                    if resp.status_code != 200:
                        progress.pages_failed += 1
                        progress.errors.append(f"HTTP {resp.status_code}: {url}")
                        self._emit(progress)
                        continue

                    content_type = resp.headers.get("content-type", "")
                    if "text/html" not in content_type and "application/xhtml" not in content_type:
                        progress.pages_skipped += 1
                        self._emit(progress)
                        continue

                    html = resp.text
                    if len(html) > settings.CRAWL_MAX_CONTENT_SIZE:
                        html = html[: settings.CRAWL_MAX_CONTENT_SIZE]

                    title, content, headings, meta = extract_main_content(html, url)
                    ch = content_hash(content)

                    page = PageResult(
                        url=url,
                        title=title or url,
                        content=content,
                        headings=headings,
                        metadata=meta,
                        content_hash=ch,
                        etag=resp.headers.get("etag"),
                        last_modified=resp.headers.get("last-modified"),
                        status_code=resp.status_code,
                        word_count=len(content.split()),
                    )

                    if ch in self._known_hashes:
                        page.is_duplicate = True
                        progress.pages_skipped += 1
                    else:
                        results.append(page)
                        progress.pages_crawled += 1
                        if self.on_page:
                            self.on_page(page)

                    # enqueue links
                    if current_depth < depth:
                        links = extract_links(html, url, same_domain=True)
                        page.links = links
                        for link in links:
                            if link not in visited:
                                queue.append((link, current_depth + 1))

                except Exception as e:
                    progress.pages_failed += 1
                    progress.errors.append(f"{url}: {str(e)[:200]}")
                    results.append(PageResult(url=url, error=str(e)))

                self._emit(progress)

        progress.status = "cancelled" if self._cancel else "completed"
        progress.current_url = ""
        self._emit(progress)
        return results

    def _emit(self, progress: CrawlProgress):
        if self.on_progress:
            self.on_progress(progress)

    async def fetch_sitemap(self, sitemap_url: str) -> List[str]:
        urls = []
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.CRAWL_USER_AGENT},
            timeout=30,
            follow_redirects=True,
        ) as client:
            try:
                resp = await client.get(sitemap_url)
                if resp.status_code != 200:
                    return urls
                soup = BeautifulSoup(resp.text, "lxml-xml")
                for loc in soup.find_all("loc"):
                    u = loc.get_text(strip=True)
                    if u:
                        urls.append(normalize_url(u))
                # nested sitemaps
                for sm in soup.find_all("sitemap"):
                    loc = sm.find("loc")
                    if loc:
                        nested = await self.fetch_sitemap(loc.get_text(strip=True))
                        urls.extend(nested)
            except Exception:
                pass
        return urls[:500]  # safety limit
