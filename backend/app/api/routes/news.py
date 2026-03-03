from __future__ import annotations
import logging
import xml.etree.ElementTree as ET
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/news", tags=["Agri News"])

RSS_URL = "https://eng.ruralvoice.in/rss/latest-posts"


class NewsItem(BaseModel):
    title: str
    link: str
    description: str
    pub_date: Optional[str] = None
    author: Optional[str] = None
    image_url: Optional[str] = None
    guid: Optional[str] = None


@router.get("/feed", response_model=list[NewsItem])
async def get_news_feed(limit: int = Query(default=10, ge=1, le=30)):
    """
    Proxy the RuralVoice RSS feed and return structured news items.
    Cross-origin RSS is fetched server-side to avoid CORS issues.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(RSS_URL, headers={"User-Agent": "AgriTranslateAI/1.0"})
            resp.raise_for_status()
            xml_text = resp.text
    except Exception as e:
        logger.error(f"Failed to fetch RSS feed: {e}")
        raise HTTPException(status_code=503, detail="Could not fetch news feed. Please try again later.")

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse RSS XML: {e}")
        raise HTTPException(status_code=502, detail="News feed format error.")

    # XML namespaces used in the feed
    ns = {
        "dc": "http://purl.org/dc/elements/1.1/",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }

    items: list[NewsItem] = []
    channel = root.find("channel")
    if channel is None:
        raise HTTPException(status_code=502, detail="Invalid RSS format — no channel element.")

    for item_el in channel.findall("item"):
        title = _text(item_el, "title") or "Untitled"
        link = _text(item_el, "link") or ""
        guid = _text(item_el, "guid") or link
        description = _clean_cdata(_text(item_el, "description") or "")
        pub_date = _text(item_el, "pubDate")
        author = _text(item_el, f"dc:creator", ns) or _text(item_el, "author")

        # Image from <enclosure url="..." type="image/..."/>
        image_url: Optional[str] = None
        enclosure = item_el.find("enclosure")
        if enclosure is not None:
            enc_type = enclosure.get("type", "")
            if enc_type.startswith("image/"):
                image_url = enclosure.get("url")

        items.append(NewsItem(
            title=_unescape_html(title),
            link=link,
            description=description[:300] + ("…" if len(description) > 300 else ""),
            pub_date=pub_date,
            author=author,
            image_url=image_url,
            guid=guid,
        ))
        if len(items) >= limit:
            break

    return items


# ── helpers ──────────────────────────────────────────────────────────────────

def _text(el: ET.Element, tag: str, ns: dict | None = None) -> Optional[str]:
    """Return stripped text of a child element, or None."""
    child = el.find(tag, ns) if ns else el.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return None


def _clean_cdata(text: str) -> str:
    """Strip leading/trailing whitespace from CDATA content."""
    return text.strip()


def _unescape_html(text: str) -> str:
    """Unescape common HTML entities."""
    return (
        text
        .replace("&#45;", "-")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
