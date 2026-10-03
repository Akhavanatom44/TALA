"""Defense-in-depth text cleanup — mirrors the Node.js implementation."""

import re
from typing import Optional

TME_LINK_RE = re.compile(r"https?://(www\.)?t\.me/[a-zA-Z0-9_+/]+", re.IGNORECASE)
TELEGRAM_ME_RE = re.compile(r"https?://(www\.)?telegram\.me/[a-zA-Z0-9_+/]+", re.IGNORECASE)
USERNAME_MENTION_RE = re.compile(r"(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{4,32})")
JOIN_PHRASES_RE = re.compile(
    r"(عضو شوید|عضو کانال|لینک کانال|لینک عضویت|جوین شوید|join (our|the)? ?channel|کانال ما|منبع\s*[:：]?)",
    re.IGNORECASE,
)


def strip_foreign_links_and_mentions(text: str) -> str:
    if not text:
        return text
    out = TME_LINK_RE.sub("", text)
    out = TELEGRAM_ME_RE.sub("", out)
    out = USERNAME_MENTION_RE.sub(r"\1", out)
    out = JOIN_PHRASES_RE.sub("", out)

    lines = [re.sub(r"[ \t]{2,}", " ", line).strip() for line in out.split("\n")]
    cleaned_lines: list[str] = []
    for line in lines:
        if line == "" and cleaned_lines and cleaned_lines[-1] == "":
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def contains_blacklisted_keyword(text: str, blacklist_raw: Optional[str]) -> Optional[str]:
    if not blacklist_raw:
        return None
    keywords = [kw.strip() for kw in re.split(r"[\n,]", blacklist_raw) if kw.strip()]
    lower = text.lower()
    for kw in keywords:
        if kw.lower() in lower:
            return kw
    return None


def build_final_caption(body: str, footer_text: Optional[str]) -> str:
    clean_body = (body or "").strip()
    footer = (footer_text or "").strip()
    if not footer:
        return clean_body
    if not clean_body:
        return footer
    return f"{clean_body}\n\n{footer}"
