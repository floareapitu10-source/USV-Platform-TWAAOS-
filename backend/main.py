import os
import json
import asyncio
import traceback
import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import contextvars
from zoneinfo import ZoneInfo
import httpx
from bs4 import BeautifulSoup
from supabase import acreate_client, AsyncClient
from dotenv import load_dotenv
from fastapi import Depends

_dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=_dotenv_path)

app = FastAPI(title="USV Events Scraper API", debug=True)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    print("Unhandled exception:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": traceback.format_exc(),
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global clients
supabase: Optional[AsyncClient] = None

_ai_debug: contextvars.ContextVar[str] = contextvars.ContextVar("ai_debug", default="")

# In-process concurrency guards to avoid duplicate scrapes from double-clicks
# or overlapping scrape_all + per-source calls.
_scrape_all_lock = asyncio.Lock()
_scrape_source_locks: dict[str, asyncio.Lock] = {}


def _get_source_lock(source_id: str) -> asyncio.Lock:
    lock = _scrape_source_locks.get(source_id)
    if lock is None:
        lock = asyncio.Lock()
        _scrape_source_locks[source_id] = lock
    return lock


def _extract_json_array(text: str) -> Optional[str]:
    if not text:
        return None

    t = str(text).strip()
    if not t:
        return None
    # Remove markdown code fences if present
    if t.startswith("```"):
        parts = t.split("```")
        if len(parts) >= 2:
            t = parts[1]
        t = t.strip()
        if t.startswith("json"):
            t = t[4:].strip()

    # Fast path
    if t.startswith("[") and t.endswith("]"):
        return t

    # Extract first JSON array in text
    start = t.find("[")
    end = t.rfind("]")
    if start != -1 and end != -1 and end > start:
        return t[start : end + 1]
    return None


def _clean_description(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip()
    if not v:
        return None
    # Some model outputs end with ellipses which looks like UI truncation.
    if v.endswith("..."):
        v = v[:-3].rstrip()
    return v or None


def _get_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = str(authorization).split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts[0].strip().lower(), parts[1].strip()
    if scheme != "bearer" or not token:
        return None
    return token


async def _supabase_get_user(access_token: str) -> dict:
    """Validate a Supabase JWT access token and return the auth user payload.

    This avoids requiring the Supabase JWT secret in the backend.
    """
    supabase_url = os.environ["SUPABASE_URL"]
    api_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing SUPABASE_ANON_KEY/SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY")

    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(
            f"{supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": api_key,
            },
        )
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase auth error: {r.status_code}: {r.text}")
    return r.json()


async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    token = _get_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")

    # Optional service-token path (server-to-server). Useful for Docker/automation.
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if service_key and token == service_key:
        return {"id": None, "role": "service_role"}

    user = await _supabase_get_user(token)
    uid = user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Token validated but missing user id")
    return {"id": uid, "email": user.get("email")}


async def require_admin(user_ctx: dict = Depends(require_user)) -> dict:
    # service_role token is treated as admin for backend-only operations
    if user_ctx.get("role") == "service_role":
        return user_ctx

    uid = user_ctx.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user context")

    client = await get_supabase()
    profile = await client.table("profiles").select("role").eq("id", uid).single().execute()
    role = (profile.data or {}).get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return {**user_ctx, "role": role}


async def get_supabase() -> AsyncClient:
    global supabase
    if supabase is None:
        supabase_url = os.environ["SUPABASE_URL"]
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
        if not supabase_key:
            raise KeyError("Missing SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_KEY")

        supabase = await acreate_client(
            supabase_url,
            supabase_key,
        )
    return supabase


def _normalize_iso_datetime(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip()
    if not v:
        return None

    # If it's a date only, add a default time.
    if len(v) == 10 and v[4] == "-" and v[7] == "-":
        v = v + "T10:00:00"

    # If it uses space separator, convert to ISO 'T'.
    if " " in v and "T" not in v:
        v = v.replace(" ", "T", 1)

    # If time has no seconds, add them.
    if "T" in v:
        date_part, time_part = v.split("T", 1)
        if "+" in time_part:
            time_main, tz = time_part.split("+", 1)
            tz = "+" + tz
        elif "-" in time_part[1:]:
            # timezone like -03:00 (skip the first char because date already has '-')
            idx = time_part.find("-", 1)
            time_main, tz = time_part[:idx], time_part[idx:]
        else:
            time_main, tz = time_part, ""

        if time_main.count(":") == 1:
            time_main = time_main + ":00"
        v = date_part + "T" + time_main + tz

    try:
        local_tz = ZoneInfo("Europe/Bucharest")
    except Exception:
        # On Windows, tz database may be missing unless tzdata is installed.
        # Fall back to the system-local tzinfo (best-effort).
        local_tz = datetime.now().astimezone().tzinfo or timezone.utc

    # Try strict-ish ISO first.
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=local_tz)
        dt_utc = dt.astimezone(timezone.utc)
        return dt_utc.isoformat().replace("+00:00", "Z")
    except Exception:
        pass

    # Try Romanian / human formats (best-effort).
    # Examples:
    # - "2 aprilie 2026, ora 17:00"
    # - "2 aprilie ora 17"
    # - "mâine 17:00"
    ro = v.lower()

    month_map = {
        "ianuarie": 1,
        "februarie": 2,
        "martie": 3,
        "aprilie": 4,
        "mai": 5,
        "iunie": 6,
        "iulie": 7,
        "august": 8,
        "septembrie": 9,
        "octombrie": 10,
        "noiembrie": 11,
        "decembrie": 12,
    }

    now = datetime.now(local_tz)

    if "poimâine" in ro or "poimaine" in ro:
        base = now.date().toordinal() + 2
        dt = datetime.fromordinal(base)
        dt = dt.replace(hour=10, minute=0, second=0, tzinfo=local_tz)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if "mâine" in ro or "maine" in ro:
        base = now.date().toordinal() + 1
        dt = datetime.fromordinal(base)
        # try to extract time
        m = re.search(r"(\d{1,2})[:\.](\d{2})", ro)
        if m:
            hh, mm = int(m.group(1)), int(m.group(2))
            dt = dt.replace(hour=hh, minute=mm, second=0, tzinfo=local_tz)
            return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        dt = dt.replace(hour=10, minute=0, second=0, tzinfo=local_tz)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    m = re.search(
        r"(?P<day>\d{1,2})\s+(?P<month>ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)(?:\s+(?P<year>\d{4}))?",
        ro,
    )
    if not m:
        return None

    day = int(m.group("day"))
    month = month_map[m.group("month")]
    year = int(m.group("year")) if m.group("year") else now.year

    hour, minute, second = 10, 0, 0
    t = re.search(r"ora\s*(\d{1,2})(?:[:\.](\d{2}))?", ro)
    if t:
        hour = int(t.group(1))
        minute = int(t.group(2)) if t.group(2) else 0
    else:
        t2 = re.search(r"(\d{1,2})[:\.](\d{2})", ro)
        if t2:
            hour = int(t2.group(1))
            minute = int(t2.group(2))

    try:
        dt_local = datetime(year, month, day, hour, minute, second, tzinfo=local_tz)
        return dt_local.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return None


class ScrapeRequest(BaseModel):
    source_id: Optional[str] = None
    scrape_all: bool = False


class ScrapedEvent(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    external_url: Optional[str] = None
    category: Optional[str] = None
    organizer_name: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "usv-events-scraper"}


@app.get("/auth/me")
async def auth_me(user_ctx: dict = Depends(require_user)):
    return {"ok": True, "user": user_ctx}


@app.get("/admin/ping")
async def admin_ping(admin_ctx: dict = Depends(require_admin)):
    return {"ok": True, "admin": admin_ctx}


@app.post("/scrape")
async def scrape_events(
    request: ScrapeRequest,
    _admin: dict = Depends(require_admin)
):
    """Scrape events from configured sources using AI"""

    try:
        client = await get_supabase()

        # Get sources to scrape
        if request.scrape_all:
            result = await client.table("scraped_sources").select("*").eq("is_active", True).execute()
            sources = result.data
        elif request.source_id:
            result = await client.table("scraped_sources").select("*").eq("id", request.source_id).execute()
            sources = result.data
        else:
            raise HTTPException(status_code=400, detail="Must specify source_id or scrape_all")

        if not sources:
            raise HTTPException(status_code=404, detail="No sources found")

        results = []

        # Acquire appropriate lock(s) to avoid overlapping scrapes.
        acquired_all = False
        acquired_source_locks: List[asyncio.Lock] = []
        try:
            if request.scrape_all:
                if _scrape_all_lock.locked():
                    raise HTTPException(status_code=409, detail="Scrape already running")
                await _scrape_all_lock.acquire()
                acquired_all = True

            # For both scrape_all and single source, lock per-source too.
            # If a per-source lock is already held (previous scrape still running),
            # skip that source instead of aborting the whole batch. This ensures
            # newly added sources (and other idle ones) still get scraped.
            skipped_busy: list[dict] = []
            runnable_sources: list[dict] = []
            for s in sources:
                lock = _get_source_lock(str(s["id"]))
                if lock.locked():
                    if not request.scrape_all and request.source_id:
                        # Explicit single-source request: surface the conflict clearly.
                        raise HTTPException(status_code=409, detail=f"Scrape already running for source {s['id']}")
                    skipped_busy.append(s)
                    continue
                await lock.acquire()
                acquired_source_locks.append(lock)
                runnable_sources.append(s)

            # Log skipped sources so the UI history shows they were not processed
            # this round (instead of silently dropping them).
            for s in skipped_busy:
                try:
                    await client.table("scrape_logs").insert({
                        "source_id": s["id"],
                        "status": "failed",
                        "events_found": 0,
                        "events_added": 0,
                        "error_message": "Skipped: a previous scrape for this source is still running",
                    }).execute()
                except Exception:
                    pass

            if not runnable_sources:
                # Nothing new can run: every requested source is busy.
                raise HTTPException(status_code=409, detail="Scrape already running for all requested sources")

            # Run scrapes concurrently to reduce end-to-end scrape_all latency,
            # but keep a small concurrency limit to avoid overloading external APIs.
            semaphore = asyncio.Semaphore(2)

            async def _run_one(source: dict) -> dict:
                async with semaphore:
                    try:
                        # Apply max timeout per source to prevent indefinite hangs
                        return await asyncio.wait_for(
                            scrape_source(client, source),
                            timeout=240.0
                        )
                    except asyncio.TimeoutError:
                        error_msg = f"Scraping timed out after 240s"
                        await client.table("scrape_logs").insert({
                            "source_id": source["id"],
                            "status": "failed",
                            "events_found": 0,
                            "events_added": 0,
                            "error_message": error_msg
                        }).execute()
                        return {
                            "source_id": source["id"],
                            "source_name": source["name"],
                            "status": "failed",
                            "error": error_msg
                        }
                    except Exception as e:
                        error_msg = f"{type(e).__name__}: {str(e)}"
                        await client.table("scrape_logs").insert({
                            "source_id": source["id"],
                            "status": "failed",
                            "events_found": 0,
                            "events_added": 0,
                            "error_message": error_msg
                        }).execute()
                        return {
                            "source_id": source["id"],
                            "source_name": source["name"],
                            "status": "failed",
                            "error": error_msg
                        }

            tasks = [asyncio.create_task(_run_one(source)) for source in runnable_sources]
            results = await asyncio.gather(*tasks)
        finally:
            # Always release locks, even if exception or timeout
            for lock in acquired_source_locks:
                try:
                    if lock.locked():
                        lock.release()
                except Exception:
                    pass
            if acquired_all:
                try:
                    if _scrape_all_lock.locked():
                        _scrape_all_lock.release()
                except Exception:
                    pass

        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        print("Unhandled scrape error:")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(e),
                "traceback": traceback.format_exc(),
            },
        )


async def scrape_source(client: AsyncClient, source: dict) -> dict:
    started = time.perf_counter()
    source_id = source["id"]
    url = source["url"]
    source_name = source.get("name") or "Unknown"
    scrape_selector = source.get("scrape_selector")
    if isinstance(scrape_selector, str):
        scrape_selector = " ".join(scrape_selector.split())
        scrape_selector = re.sub(r"([.#])\s+", r"\1", scrape_selector)
    
    default_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }

    # Fetch the webpage
    async with httpx.AsyncClient(timeout=60.0, headers=default_headers) as http_client:
        try:
            response = await http_client.get(url, follow_redirects=True)
            response.raise_for_status()
        except Exception as e:
            duration_ms = int((time.perf_counter() - started) * 1000)
            raise Exception(f"Failed to fetch {url}: {str(e)} (duration_ms={duration_ms})")
    
    # Parse HTML
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Remove scripts and styles
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    
    # Get text content
    selected = None
    if scrape_selector:
        selected = soup.select(scrape_selector)
        if selected:
            text_content = "\n".join(el.get_text(separator="\n", strip=True) for el in selected)
        else:
            text_content = soup.get_text(separator="\n", strip=True)
    else:
        text_content = soup.get_text(separator="\n", strip=True)
    
    # Limit content length for API
    max_chars = 30000
    if len(text_content) > max_chars:
        text_content = text_content[:max_chars]
    
    # Use OpenAI to extract events
    _ai_debug.set("")
    content_chars = 0
    try:
        content_chars = len(text_content or "")
    except Exception:
        content_chars = 0

    events = await extract_events_with_ai(text_content, url, source_name)

    detail_links: list[str] = []
    detail_limit = 4
    try:
        if "usv.ro" in str(url).lower():
            detail_limit = 6
    except Exception:
        detail_limit = 4

    is_usv_listing = False
    try:
        u = str(url).lower()
        if "usv.ro" in u and "stiri-si-evenimente" in u:
            is_usv_listing = True
    except Exception:
        is_usv_listing = False
    # If very few events found on a listing page, follow item links (detail pages) and try again.
    # Some sources show multiple items but the AI only reliably extracts from detail pages.
    if (not events or len(events) < 2):
        blocks_to_scan = selected if selected else [soup]

        def _add_link(href: str):
            href = str(href).strip()
            if not href or href.startswith("#") or href.startswith("javascript:"):
                return
            if href.startswith("/"):
                href = str(httpx.URL(url).join(href))
            if not href.startswith("http"):
                return
            if any(href.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".pdf")):
                return
            if href not in detail_links:
                detail_links.append(href)

        def _extract_links_from_soup(listing_soup: BeautifulSoup):
            listing_selected = listing_soup.select(scrape_selector) if scrape_selector else []
            if listing_selected:
                blocks = listing_selected
            else:
                blocks = [listing_soup]

            for block in blocks:
                preferred_anchors = block.select("a.learn_more[href], h2 a[href]")
                anchors = preferred_anchors if preferred_anchors else block.select("a[href]")
                for a in anchors:
                    href = a.get("href")
                    if href:
                        _add_link(href)
                if len(detail_links) >= detail_limit:
                    return

        for el in blocks_to_scan:
            # Prefer common "read more" patterns first (USV uses a.learn_more)
            preferred_anchors = el.select("a.learn_more[href], h2 a[href]")
            anchors = preferred_anchors if preferred_anchors else el.select("a[href]")
            for a in anchors:
                href = a.get("href")
                if href:
                    _add_link(href)
            if len(detail_links) >= detail_limit:
                break

        # USV listing pagination: collect links from additional pages too.
        if is_usv_listing and len(detail_links) < detail_limit:
            async with httpx.AsyncClient(timeout=20.0, headers=default_headers) as list_client:
                for page in range(2, 5):
                    try:
                        page_url = str(httpx.URL(url).copy_set_param("paged", str(page)))
                        r2 = await list_client.get(page_url, follow_redirects=True)
                        if r2.status_code >= 400:
                            break
                        s2 = BeautifulSoup(r2.text, "html.parser")
                        for tag in s2(["script", "style", "nav", "footer", "header"]):
                            tag.decompose()
                        before = len(detail_links)
                        _extract_links_from_soup(s2)
                        if len(detail_links) >= detail_limit:
                            break
                        # Stop if a page yields no new links
                        if len(detail_links) == before:
                            break
                    except Exception as e:
                        print(f"Failed to fetch listing page {page}: {e}")
                        break

        # Fallback: sometimes the selector targets only the text block and misses the link.
        if not detail_links:
            for a in soup.select("a.learn_more[href], h2 a[href]"):
                href = a.get("href")
                if href:
                    _add_link(href)
                if len(detail_links) >= detail_limit:
                    break

        detail_texts: list[str] = []

        semaphore = asyncio.Semaphore(4)

        async def _fetch_detail(link: str) -> Optional[str]:
            async with semaphore:
                try:
                    async with httpx.AsyncClient(timeout=20.0, headers=default_headers) as detail_client:
                        r = await detail_client.get(link, follow_redirects=True)
                        r.raise_for_status()
                        s = BeautifulSoup(r.text, "html.parser")
                        for tag in s(["script", "style", "nav", "footer", "header"]):
                            tag.decompose()
                        return s.get_text(separator="\n", strip=True)
                except Exception as e:
                    print(f"Failed to fetch detail page {link}: {e}")
                    return None

        tasks = [asyncio.create_task(_fetch_detail(link)) for link in detail_links[:detail_limit]]
        fetched = await asyncio.gather(*tasks)
        for t in fetched:
            if t:
                detail_texts.append(t)

        if detail_texts:
            # Extract per-detail-page in parallel to keep end-to-end time within the
            # per-source timeout budget. Sequential extraction easily exceeds 240s
            # when there are 4+ detail pages and the AI is slow.
            _ai_debug.set("")
            ai_sem = asyncio.Semaphore(3)

            async def _extract_one(idx: int, link: str) -> list[dict]:
                async with ai_sem:
                    try:
                        page_text = detail_texts[idx]
                        if len(page_text) > max_chars:
                            page_text = page_text[:max_chars]
                        return await extract_events_with_ai(page_text, link, source_name) or []
                    except Exception as e:
                        print(f"Failed to extract events from detail page {link}: {e}")
                        return []

            extract_tasks = [
                asyncio.create_task(_extract_one(idx, link))
                for idx, link in enumerate(detail_links[: min(detail_limit, len(detail_texts))])
            ]
            extract_results = await asyncio.gather(*extract_tasks, return_exceptions=False)
            extracted_events: list[dict] = []
            for page_events in extract_results:
                if page_events:
                    extracted_events.extend(page_events)

            # Fallback: if per-page extraction yields nothing, try combined
            if not extracted_events:
                combined = "\n\n---\n\n".join(detail_texts)
                if len(combined) > max_chars:
                    combined = combined[:max_chars]
                _ai_debug.set("")
                extracted_events = await extract_events_with_ai(combined, url, source_name)

            # Merge listing results with detail results (dedup later during insert/upsert).
            if extracted_events:
                events = (events or []) + extracted_events
    
    if not events:
        links_debug = ""
        if detail_links:
            links_debug = f" links={len(detail_links)} first={detail_links[:2]}"

        ai_debug = _ai_debug.get()
        ai_debug_part = f" ai={ai_debug}" if ai_debug else ""
        # Log partial/empty result
        await client.table("scrape_logs").insert({
            "source_id": source_id,
            "status": "partial",
            "events_found": 0,
            "events_added": 0,
            "error_message": f"No events found in content (selector={scrape_selector}, chars={len(text_content)}){links_debug}{ai_debug_part}"
        }).execute()
        
        # Update last scraped timestamp
        await client.table("scraped_sources").update({
            "last_scraped_at": datetime.utcnow().isoformat()
        }).eq("id", source_id).execute()
        
        return {
            "source_id": source_id,
            "source_name": source_name,
            "status": "partial",
            "events_found": 0,
            "events_added": 0,
            "ai_debug": ai_debug,
            "detail_links_count": len(detail_links),
            "detail_links_preview": detail_links[:2],
        }
    
    # Get default organizer (admin user or first organizer)
    organizer_result = await client.table("profiles").select("id").eq("role", "admin").limit(1).execute()
    
    if not organizer_result.data:
        organizer_result = await client.table("profiles").select("id").eq("role", "organizer").limit(1).execute()
    
    if not organizer_result.data:
        raise Exception("No admin or organizer found to assign events")
    
    organizer_id = organizer_result.data[0]["id"]
    
    # Get categories for mapping
    categories_result = await client.table("categories").select("id, name").execute()
    categories_map = {c["name"].lower(): c["id"] for c in categories_result.data}
    
    # Insert events
    events_added = 0
    events_updated = 0
    for event in events:
        try:
            # Organizer name from AI or fallback to the source label.
            organizer_name_value = None
            try:
                organizer_name_value = (event.get("organizer_name") or "").strip() if event.get("organizer_name") is not None else None
            except Exception:
                organizer_name_value = None
            if not organizer_name_value:
                organizer_name_value = source_name

            # Map category
            category_id = None
            if event.get("category"):
                category_lower = event["category"].lower()
                for cat_name, cat_id in categories_map.items():
                    if cat_name in category_lower or category_lower in cat_name:
                        category_id = cat_id
                        break
            
            # Prefer upsert/update by a stable per-event source_url key.
            # If the model gives a real per-event URL, use it.
            # Otherwise, generate a deterministic synthetic key so multiple events from a listing page don't overwrite each other.
            external_url_value = event.get("external_url")
            if external_url_value and str(external_url_value).strip() and str(external_url_value).strip() != str(url).strip():
                source_url_value = str(external_url_value).strip()
            else:
                key_raw = f"{url}|{event.get('title','')}|{event.get('start_date','')}"
                key_hash = hashlib.sha1(key_raw.encode("utf-8", errors="ignore")).hexdigest()[:16]
                source_url_value = f"{url}#event={key_hash}"

            existing_by_url = await client.table("events").select("id").eq("source_url", source_url_value).limit(1).execute()

            if existing_by_url.data:
                await client.table("events").update({
                    "title": event["title"],
                    "description": _clean_description(event.get("description")),
                    "location": event.get("location", "Suceava"),
                    "start_date": event["start_date"],
                    "end_date": event.get("end_date"),
                    "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                    "source_url": source_url_value,
                    "source_name": source_name,
                    "organizer_name": organizer_name_value,
                    "category_id": category_id,
                    "organizer_id": organizer_id,
                    "is_public": True,
                    "is_scraped": True,
                    "status": "published",
                }).eq("id", existing_by_url.data[0]["id"]).execute()
                events_updated += 1
                continue

            # Check for duplicate by title and exact datetime (fallback)
            existing = await client.table("events").select("id").eq("title", event["title"]).eq("start_date", event["start_date"]).execute()

            if existing.data:
                # If we found the same event again, update it (helps fix old wrong data and migrate URLs)
                await client.table("events").update({
                    "description": _clean_description(event.get("description")),
                    "location": event.get("location", "Suceava"),
                    "end_date": event.get("end_date"),
                    "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                    "source_url": source_url_value,
                    "source_name": source_name,
                    "organizer_name": organizer_name_value,
                    "category_id": category_id,
                    "organizer_id": organizer_id,
                    "is_public": True,
                    "is_scraped": True,
                    "status": "published",
                }).eq("id", existing.data[0]["id"]).execute()
                events_updated += 1
                continue

            # Insert event
            await client.table("events").insert({
                "title": event["title"],
                "description": _clean_description(event.get("description")),
                "location": event.get("location", "Suceava"),
                "start_date": event["start_date"],
                "end_date": event.get("end_date"),
                "category_id": category_id,
                "organizer_id": organizer_id,
                "is_public": True,
                "is_scraped": True,
                "source_url": source_url_value,
                "source_name": source_name,
                "organizer_name": organizer_name_value,
                "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                "status": "published"
            }).execute()
            
            events_added += 1
        except Exception as e:
            print(f"Error inserting event: {e}")
            continue
    
    duration_ms = int((time.perf_counter() - started) * 1000)
    debug_bits: List[str] = []
    try:
        dbg = _ai_debug.get()
        if dbg:
            debug_bits.append(str(dbg))
    except Exception:
        pass
    debug_bits.append(f"duration_ms={duration_ms}")
    debug_bits.append(f"content_chars={content_chars}")
    if events_updated:
        debug_bits.append(f"updated={events_updated}")

    # Log success
    await client.table("scrape_logs").insert({
        "source_id": source_id,
        "status": "success",
        "events_found": len(events),
        "events_added": events_added,
        "error_message": "; ".join(debug_bits) if debug_bits else None,
    }).execute()
    
    # Update last scraped timestamp
    await client.table("scraped_sources").update({
        "last_scraped_at": datetime.utcnow().isoformat()
    }).eq("id", source_id).execute()
    
    return {
        "source_id": source_id,
        "source_name": source_name,
        "status": "success",
        "events_found": len(events),
        "events_added": events_added,
    }


async def extract_events_with_ai(content: str, source_url: str, source_name: str) -> List[dict]:
    """Use OpenAI to extract structured event data from text content"""

    gemini_key = os.getenv("GEMINI_API_KEY")

    # Keep prompts bounded: huge pages can drastically slow down Gemini and increase failure rate.
    # This also helps keep scrape_all within a reasonable time budget.
    try:
        max_chars = 12000
        content = content[:max_chars]
    except Exception:
        pass

    system_prompt = """You are an expert at extracting event information from web content.
Extract all events you can find from the provided text. For each event, extract:
- title: The name/title of the event
- description: A clear, complete description based on the source text. Include all important details you can find.
  Do NOT truncate the description and DO NOT end it with ellipses ("...").
- organizer_name: The real organizer name if explicitly mentioned (e.g., USV, a faculty, a club, Primaria Suceava). If not stated, omit or leave empty.
- location: Where the event takes place
- start_date: The start date and time in ISO 8601 format. If the text says “ora 17:00”, keep that exact local time.
- end_date: The end date and time in ISO 8601 format (if available)
- external_url: The link to the event page if present
- category: A category name if you can infer it (e.g. Cultural, Academic, Sport, Workshop)

Rules:
- Return only valid JSON
- Do not include any additional text
- Use null for missing optional fields
- Dates must be ISO 8601
Important:
- For dates, use the current year if not specified
- Convert Romanian month names to numbers
- If only a date is given without time, use 10:00:00 as default time
- Location should default to "Suceava" if not specified"""

    user_prompt = f"""Extract events from this content from {source_name}:

{content}

Return only a JSON array of events."""

    async def _gemini_generate(prompt_text: str, use_schema: bool = True) -> str:
        gemini_base = "https://generativelanguage.googleapis.com/v1beta/models"
        # Try flash family first, then pro as a fallback. Each call has a tight
        # timeout so the total budget stays within the per-source limit.
        model_candidates = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-2.5-pro",
        ]
        generation_config: dict = {
            "temperature": 0.1,
            "maxOutputTokens": 4000,
            "responseMimeType": "application/json",
        }
        if use_schema:
            generation_config["responseSchema"] = {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING"},
                        "description": {"type": "STRING"},
                        "organizer_name": {"type": "STRING"},
                        "location": {"type": "STRING"},
                        "start_date": {"type": "STRING"},
                        "end_date": {"type": "STRING"},
                        "external_url": {"type": "STRING"},
                        "category": {"type": "STRING"},
                    },
                    "required": ["title", "start_date"],
                },
            }
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}],
                }
            ],
            "generationConfig": generation_config,
        }

        last_error: Optional[str] = None
        async with httpx.AsyncClient(timeout=20.0) as client:
            for model in model_candidates:
                url = f"{gemini_base}/{model}:generateContent"
                try:
                    # One quick retry only: anything more eats the per-source budget.
                    r = None
                    for delay in (0.0, 0.5):
                        if delay:
                            await asyncio.sleep(delay)
                        r = await client.post(
                            url,
                            params={"key": gemini_key},
                            json=payload,
                        )
                        if r.status_code in (429, 500, 502, 503, 504):
                            continue
                        break
                    if r.status_code == 404:
                        last_error = f"404 Not Found for model {model}"  # try next
                        continue
                    r.raise_for_status()
                    data = r.json()

                    candidates = data.get("candidates") or []
                    parts = (
                        (candidates[0].get("content") or {}).get("parts")
                        if candidates
                        else None
                    )
                    if not parts:
                        _ai_debug.set(f"gemini_model={model} empty_parts")
                        return ""
                    _ai_debug.set(f"gemini_model={model}")
                    return (parts[0].get("text") or "").strip()
                except httpx.HTTPStatusError as e:
                    body = ""
                    try:
                        body = e.response.text
                    except Exception:
                        body = ""
                    last_error = f"Gemini HTTP {e.response.status_code}: {body}"
                    # Try next model on transient upstream issues.
                    if e.response.status_code in (429, 500, 502, 503, 504):
                        continue
                    break
                except httpx.RequestError as e:
                    last_error = f"Gemini request error: {type(e).__name__}: {str(e)}"
                    continue

        _ai_debug.set(f"gemini_error={last_error}")
        return ""


    def _parse_events_from_text(text: str) -> List[dict]:
        extracted = _extract_json_array(text)
        if extracted is None:
            raise json.JSONDecodeError("No JSON array found", text or "", 0)
        return json.loads(extracted)


    try:
        result_text: str

        if gemini_key:
            prompt = (
                system_prompt
                + "\n\n---\n\n"
                + user_prompt
                + "\n"
            )
            result_text = await _gemini_generate(prompt)
            # Strict JSON schema sometimes makes the model return "[]" when it is
            # unsure. Retry once without the schema so the model can produce a
            # looser but still valid JSON array.
            if (not result_text) or result_text.strip() in ("[]", ""):
                result_text = await _gemini_generate(prompt, use_schema=False)
            if not result_text:
                return []
        else:
            print("No GEMINI_API_KEY configured")
            _ai_debug.set("no_ai_key")
            return []
        
        try:
            events = _parse_events_from_text(result_text)
        except json.JSONDecodeError as e:
            if gemini_key:
                # Ask Gemini to repair its own output into strict JSON
                repair_prompt = (
                    "Return ONLY a valid JSON array of event objects. "
                    "Do not include any commentary. Fix any broken quotes/newlines. "
                    "Here is the invalid output to repair:\n\n"
                    + result_text[:6000]
                )
                repaired = await _gemini_generate(repair_prompt)
                try:
                    events = _parse_events_from_text(repaired)
                except json.JSONDecodeError:
                    return []
            else:
                raise e
        
        # Validate and clean events
        valid_events = []
        now_utc = datetime.now(timezone.utc)
        past_cutoff = now_utc - timedelta(days=180)
        for event in events:
            title = event.get("title")
            start_date_raw = event.get("start_date")
            start_date = _normalize_iso_datetime(start_date_raw)
            if title and start_date:
                try:
                    dt = datetime.fromisoformat(str(start_date).replace("Z", "+00:00"))
                    if dt < past_cutoff:
                        continue
                except Exception:
                    pass
                event["start_date"] = start_date
                end_date = _normalize_iso_datetime(event.get("end_date"))
                event["end_date"] = end_date if end_date else None

                # Normalize other optional fields so we don't insert empty strings into typed columns.
                for k in ("description", "location", "external_url", "category"):
                    v = event.get(k)
                    if v is None:
                        continue
                    sv = str(v).strip()
                    event[k] = sv if sv else None

                # If the model didn't provide a per-event URL, fall back to the page we extracted from.
                # This makes QR codes and "Link extern" usable, especially for detail-page extraction.
                if not event.get("external_url"):
                    try:
                        su = str(source_url).strip()
                        event["external_url"] = su if su.startswith("http") else None
                    except Exception:
                        event["external_url"] = None
                valid_events.append(event)

        return valid_events
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        snippet = ""
        try:
            snippet = result_text[:220] if "result_text" in locals() and result_text else ""
        except Exception:
            snippet = ""
        _ai_debug.set(f"json_parse_error={str(e)} text_snippet={snippet}")
        return []
    except Exception as e:
        print(f"AI API error: {e}")
        _ai_debug.set(f"ai_exception={str(e)}")
        return []


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
