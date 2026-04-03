import os
import json
import asyncio
import traceback
import hashlib
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

        for source in sources:
            try:
                scrape_result = await scrape_source(client, source)
                results.append(scrape_result)
            except Exception as e:
                # Log failed scrape
                await client.table("scrape_logs").insert({
                    "source_id": source["id"],
                    "status": "failed",
                    "events_found": 0,
                    "events_added": 0,
                    "error_message": str(e)
                }).execute()
                results.append({
                    "source_id": source["id"],
                    "source_name": source["name"],
                    "status": "failed",
                    "error": str(e)
                })

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
    """Scrape a single source and extract events using AI"""
    
    url = source["url"]
    source_id = source["id"]
    source_name = source["name"]
    scrape_selector = source.get("scrape_selector")
    if isinstance(scrape_selector, str):
        scrape_selector = " ".join(scrape_selector.split())
        scrape_selector = re.sub(r"([.#])\s+", r"\1", scrape_selector)
    
    # Fetch the webpage
    async with httpx.AsyncClient(timeout=60.0) as http_client:
        try:
            response = await http_client.get(url, follow_redirects=True)
            response.raise_for_status()
        except Exception as e:
            raise Exception(f"Failed to fetch {url}: {str(e)}")
    
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
    events = await extract_events_with_ai(text_content, url, source_name)

    detail_links: list[str] = []
    detail_limit = 6
    try:
        if "usv.ro" in str(url).lower():
            detail_limit = 20
    except Exception:
        detail_limit = 6

    is_usv_listing = False
    try:
        u = str(url).lower()
        if "usv.ro" in u and "stiri-si-evenimente" in u:
            is_usv_listing = True
    except Exception:
        is_usv_listing = False
    # If very few events found on a listing page, follow item links (detail pages) and try again.
    # Some sources show multiple items but the AI only reliably extracts from detail pages.
    if (not events or len(events) < 2) and selected:
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

        for el in selected:
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
            async with httpx.AsyncClient(timeout=60.0) as list_client:
                for page in range(2, 7):
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
        async with httpx.AsyncClient(timeout=60.0) as detail_client:
            for link in detail_links[:detail_limit]:
                try:
                    r = await detail_client.get(link, follow_redirects=True)
                    r.raise_for_status()
                    s = BeautifulSoup(r.text, "html.parser")
                    for tag in s(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()
                    detail_texts.append(s.get_text(separator="\n", strip=True))
                except Exception as e:
                    print(f"Failed to fetch detail page {link}: {e}")

        if detail_texts:
            # Extract per-detail-page to keep URLs and context correct.
            extracted_events: list[dict] = []
            _ai_debug.set("")
            for idx, link in enumerate(detail_links[: min(detail_limit, len(detail_texts))]):
                try:
                    page_text = detail_texts[idx]
                    if len(page_text) > max_chars:
                        page_text = page_text[:max_chars]
                    page_events = await extract_events_with_ai(page_text, link, source_name)
                    if page_events:
                        extracted_events.extend(page_events)
                except Exception as e:
                    print(f"Failed to extract events from detail page {link}: {e}")

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
                    "description": event.get("description"),
                    "location": event.get("location", "Suceava"),
                    "start_date": event["start_date"],
                    "end_date": event.get("end_date"),
                    "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                    "source_url": source_url_value,
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
                    "description": event.get("description"),
                    "location": event.get("location", "Suceava"),
                    "end_date": event.get("end_date"),
                    "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                    "source_url": source_url_value,
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
                "description": event.get("description"),
                "location": event.get("location", "Suceava"),
                "start_date": event["start_date"],
                "end_date": event.get("end_date"),
                "category_id": category_id,
                "organizer_id": organizer_id,
                "is_public": True,
                "is_scraped": True,
                "source_url": source_url_value,
                "external_url": external_url_value if external_url_value and str(external_url_value).strip() != str(url).strip() else None,
                "status": "published"
            }).execute()
            
            events_added += 1
        except Exception as e:
            print(f"Error inserting event: {e}")
            continue
    
    # Log success
    await client.table("scrape_logs").insert({
        "source_id": source_id,
        "status": "success",
        "events_found": len(events),
        "events_added": events_added,
        "error_message": f"updated={events_updated}" if events_updated else None,
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
        "events_updated": events_updated,
    }


async def extract_events_with_ai(content: str, source_url: str, source_name: str) -> List[dict]:
    """Use OpenAI to extract structured event data from text content"""

    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    system_prompt = """You are an expert at extracting event information from web content.
Extract all events you can find from the provided text. For each event, extract:
- title: The name/title of the event
- description: 2-4 sentences with concrete details from the text (what happens, who is it for, key highlights). Do NOT use generic filler.
- location: Where the event takes place
- start_date: The start date and time in ISO 8601 format. If the text says “ora 17:00”, keep that exact local time.
- end_date: The end date and time in ISO 8601 format (if available)
- external_url: A link to more information (if available)
- category: One of: Academic, Cultural, Sport, Social, Cariera, Voluntariat, Tech

Language requirement:
- Keep the description in the SAME language as the source content.
- If the content is Romanian or mixed Romanian/English, write the description in Romanian.
- Do NOT translate Romanian content into English.

Return ONLY a valid JSON array of event objects. If no events are found, return an empty array [].
Do not include any explanation or markdown, just the JSON array.

Important:
- For dates, use the current year if not specified
- Convert Romanian month names to numbers
- If only a date is given without time, use 10:00:00 as default time
- Location should default to "Suceava" if not specified"""

    user_prompt = f"""Extract events from this content from {source_name}:

{content}

Return only a JSON array of events."""

    async def _gemini_generate(prompt_text: str) -> str:
        gemini_base = "https://generativelanguage.googleapis.com/v1beta/models"
        model_candidates = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-2.5-pro",
        ]
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 4000,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "title": {"type": "STRING"},
                            "description": {"type": "STRING"},
                            "location": {"type": "STRING"},
                            "start_date": {"type": "STRING"},
                            "end_date": {"type": "STRING"},
                            "external_url": {"type": "STRING"},
                            "category": {"type": "STRING"},
                        },
                        "required": ["title", "start_date"],
                    },
                },
            },
        }

        last_error: Optional[str] = None
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in model_candidates:
                url = f"{gemini_base}/{model}:generateContent"
                try:
                    r = await client.post(
                        url,
                        params={"key": gemini_key},
                        json=payload,
                    )
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
                    break

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
            if not result_text:
                return []
        elif openai_key:
            from openai import AsyncOpenAI

            openai = AsyncOpenAI(api_key=openai_key)
            response = await openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=4000,
            )
            result_text = response.choices[0].message.content.strip()
            _ai_debug.set("openai_model=gpt-4o-mini")
        else:
            print("No GEMINI_API_KEY or OPENAI_API_KEY configured")
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
                events = _parse_events_from_text(repaired)
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
                if end_date:
                    event["end_date"] = end_date
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
