"""Core post-processing engine — mirrors src/lib/bot/engine.ts from the
Next.js version. Album buffering is done in-memory because this runs as a
single long-lived asyncio process (uvicorn), which is the same assumption
the Node.js implementation makes.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.gemini_client import DEFAULT_FREEFIRE_PROMPT, DEFAULT_GOLD_PROMPT, analyze_post
from app.models import DestinationChannel, ProcessedPost, SourceChannel
from app.sanitize import build_final_caption, contains_blacklisted_keyword, strip_foreign_links_and_mentions
from app.settings_service import get_settings, update_settings
from app.telegram_client import (
    build_inline_keyboard,
    publish_media_group,
    publish_photo,
    publish_text,
    publish_video,
)

ALBUM_FLUSH_DELAY_SECONDS = 2.0
_album_buffers: dict[str, dict] = {}


def extract_media(message: dict) -> Optional[dict]:
    photos = message.get("photo")
    if photos:
        return {"type": "photo", "file_id": photos[-1]["file_id"]}
    video = message.get("video")
    if video:
        return {"type": "video", "file_id": video["file_id"]}
    return None


def _chat_id_candidates(chat: dict) -> list[str]:
    candidates = [str(chat.get("id"))]
    username = chat.get("username")
    if username:
        candidates.append(f"@{username}")
        candidates.append(username)
    return candidates


def find_source_channel(db: Session, chat: dict) -> Optional[SourceChannel]:
    candidates = _chat_id_candidates(chat)
    return (
        db.query(SourceChannel)
        .filter(SourceChannel.active.is_(True), SourceChannel.chat_id.in_(candidates))
        .first()
    )


def get_active_destination(db: Session, purpose: str) -> Optional[DestinationChannel]:
    return (
        db.query(DestinationChannel)
        .filter(DestinationChannel.purpose == purpose, DestinationChannel.active.is_(True))
        .first()
    )


def mark_seen(db: Session, source_id: int) -> None:
    row = db.query(SourceChannel).get(source_id)
    if row:
        row.total_seen = (row.total_seen or 0) + 1
        row.last_message_at = datetime.utcnow()
        db.commit()


def mark_posted(db: Session, source_id: int) -> None:
    row = db.query(SourceChannel).get(source_id)
    if row:
        row.total_posted = (row.total_posted or 0) + 1
        db.commit()


def claim_message(
    db: Session,
    source_channel_id: int,
    source_message_id: int,
    purpose: str,
    original_text: str,
    media_group_id: Optional[str],
    media_type: Optional[str],
) -> Optional[ProcessedPost]:
    row = ProcessedPost(
        source_channel_id=source_channel_id,
        source_message_id=source_message_id,
        purpose=purpose,
        original_text=original_text,
        media_group_id=media_group_id,
        media_type=media_type,
        status="pending_review",
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        return None


async def run_analysis(db: Session, purpose: str, text: str):
    settings = get_settings(db)
    blacklist_hit = contains_blacklisted_keyword(text, settings.blacklist_keywords)
    if blacklist_hit:
        return False, "", f"کلمه ممنوعه یافت شد: {blacklist_hit}"

    pre_cleaned = strip_foreign_links_and_mentions(text or "")
    if not settings.gemini_api_key:
        return False, "", "کلید Gemini تنظیم نشده است"

    prompt = (
        settings.freefire_prompt or DEFAULT_FREEFIRE_PROMPT
        if purpose == "freefire"
        else settings.gold_prompt or DEFAULT_GOLD_PROMPT
    )
    result = await analyze_post(settings.gemini_api_key, settings.gemini_model, prompt, pre_cleaned)
    final_text = strip_foreign_links_and_mentions(result.rewritten_text)
    return result.relevant, final_text, result.reason


async def _wait_for_rate_limit(db: Session, purpose: str, min_interval_seconds: int) -> None:
    if not min_interval_seconds or min_interval_seconds <= 0:
        return
    settings = get_settings(db)
    last = settings.last_posted_at_freefire if purpose == "freefire" else settings.last_posted_at_gold
    if not last:
        return
    elapsed = (datetime.utcnow() - last).total_seconds()
    wait_time = min_interval_seconds - elapsed
    if wait_time > 0:
        await asyncio.sleep(wait_time)


def _touch_last_posted(db: Session, purpose: str) -> None:
    if purpose == "freefire":
        update_settings(db, last_posted_at_freefire=datetime.utcnow())
    else:
        update_settings(db, last_posted_at_gold=datetime.utcnow())


def _finalize(db: Session, row_id: int, **patch) -> None:
    row = db.query(ProcessedPost).get(row_id)
    if not row:
        return
    for key, value in patch.items():
        setattr(row, key, value)
    db.commit()


async def publish_single(db: Session, row_id: int, purpose: str, caption: str, media: Optional[dict], source_channel_id: int) -> None:
    settings = get_settings(db)
    destination = get_active_destination(db, purpose)
    if not settings.bot_token or not destination:
        _finalize(db, row_id, status="error", reason="مقصد یا توکن ربات تنظیم نشده است")
        return

    await _wait_for_rate_limit(db, purpose, settings.min_post_interval_seconds)
    keyboard = build_inline_keyboard(destination.button_text, destination.button_url)
    final_caption = build_final_caption(caption, destination.footer_text)

    if media and media["type"] == "photo":
        result = await publish_photo(settings.bot_token, destination.chat_id, media["file_id"], final_caption, keyboard)
    elif media and media["type"] == "video":
        result = await publish_video(settings.bot_token, destination.chat_id, media["file_id"], final_caption, keyboard)
    else:
        result = await publish_text(
            settings.bot_token, destination.chat_id, final_caption, keyboard, destination.disable_link_preview
        )

    if not result.ok:
        _finalize(db, row_id, status="error", reason=result.error or "خطای تلگرام")
        return

    message_id = getattr(result.result, "message_id", "")
    _finalize(
        db,
        row_id,
        status="posted",
        rewritten_text=final_caption,
        destination_chat_id=destination.chat_id,
        destination_message_id=str(message_id),
    )
    mark_posted(db, source_channel_id)
    _touch_last_posted(db, purpose)


async def publish_album(db: Session, row_id: int, purpose: str, caption: str, media_items: list[dict], source_channel_id: int) -> None:
    settings = get_settings(db)
    destination = get_active_destination(db, purpose)
    if not settings.bot_token or not destination:
        _finalize(db, row_id, status="error", reason="مقصد یا توکن ربات تنظیم نشده است")
        return

    await _wait_for_rate_limit(db, purpose, settings.min_post_interval_seconds)
    final_caption = build_final_caption(caption, destination.footer_text)
    result = await publish_media_group(settings.bot_token, destination.chat_id, media_items, final_caption)

    if not result.ok:
        _finalize(db, row_id, status="error", reason=result.error or "خطای تلگرام")
        return

    ids = ",".join(str(getattr(m, "message_id", "")) for m in (result.result or []))
    _finalize(
        db,
        row_id,
        status="posted",
        rewritten_text=final_caption,
        destination_chat_id=destination.chat_id,
        destination_message_id=ids,
    )
    mark_posted(db, source_channel_id)
    _touch_last_posted(db, purpose)


async def process_single_message(source_row_id: int, message: dict) -> None:
    db = SessionLocal()
    try:
        source_row = db.query(SourceChannel).get(source_row_id)
        if not source_row:
            return
        mark_seen(db, source_row.id)
        purpose = source_row.purpose
        text = message.get("caption") or message.get("text") or ""
        media = extract_media(message)

        row = claim_message(db, source_row.id, message["message_id"], purpose, text, None, media["type"] if media else None)
        if not row:
            return

        try:
            relevant, rewritten_text, reason = await run_analysis(db, purpose, text)
            if not relevant:
                _finalize(db, row.id, status="skipped", reason=reason or "نامرتبط تشخیص داده شد")
                return

            settings = get_settings(db)
            auto_publish = settings.auto_publish_freefire if purpose == "freefire" else settings.auto_publish_gold

            if not auto_publish:
                _finalize(
                    db,
                    row.id,
                    status="pending_review",
                    rewritten_text=rewritten_text,
                    payload=json.dumps({"media": media}),
                )
                return

            await publish_single(db, row.id, purpose, rewritten_text, media, source_row.id)
        except Exception as exc:  # noqa: BLE001
            _finalize(db, row.id, status="error", reason=str(exc))
    finally:
        db.close()


async def process_album(source_row_id: int, group_id: str, items: list[dict]) -> None:
    db = SessionLocal()
    try:
        source_row = db.query(SourceChannel).get(source_row_id)
        if not source_row:
            return
        mark_seen(db, source_row.id)
        purpose = source_row.purpose
        sorted_items = sorted(items, key=lambda m: m["message_id"])
        first_id = sorted_items[0]["message_id"]
        text = next((m.get("caption") for m in sorted_items if m.get("caption")), "") or ""
        media_items = [m for m in (extract_media(i) for i in sorted_items) if m]

        row = claim_message(db, source_row.id, first_id, purpose, text, group_id, "album")
        if not row:
            return

        try:
            relevant, rewritten_text, reason = await run_analysis(db, purpose, text)
            if not relevant:
                _finalize(db, row.id, status="skipped", reason=reason or "نامرتبط تشخیص داده شد")
                return

            settings = get_settings(db)
            auto_publish = settings.auto_publish_freefire if purpose == "freefire" else settings.auto_publish_gold

            if not auto_publish:
                _finalize(
                    db,
                    row.id,
                    status="pending_review",
                    rewritten_text=rewritten_text,
                    payload=json.dumps({"media_items": media_items}),
                )
                return

            if not media_items:
                _finalize(db, row.id, status="skipped", reason="آلبوم بدون رسانه قابل ارسال")
                return

            await publish_album(db, row.id, purpose, rewritten_text, media_items, source_row.id)
        except Exception as exc:  # noqa: BLE001
            _finalize(db, row.id, status="error", reason=str(exc))
    finally:
        db.close()


def _schedule_album_flush(key: str) -> None:
    group = _album_buffers.get(key)
    if not group:
        return

    old_task = group.get("task")
    if old_task:
        old_task.cancel()

    async def _flush():
        try:
            await asyncio.sleep(ALBUM_FLUSH_DELAY_SECONDS)
        except asyncio.CancelledError:
            return
        final_group = _album_buffers.pop(key, None)
        if not final_group:
            return
        await process_album(final_group["source_id"], key.split(":", 1)[1], final_group["items"])

    group["task"] = asyncio.create_task(_flush())


async def handle_channel_post(message: dict) -> None:
    db = SessionLocal()
    try:
        source_row = find_source_channel(db, message.get("chat", {}))
        if not source_row:
            return
        source_id = source_row.id
    finally:
        db.close()

    media_group_id = message.get("media_group_id")
    if media_group_id:
        key = f"{source_id}:{media_group_id}"
        group = _album_buffers.get(key)
        if group:
            group["items"].append(message)
        else:
            _album_buffers[key] = {"source_id": source_id, "items": [message], "task": None}
        _schedule_album_flush(key)
        return

    await process_single_message(source_id, message)


async def approve_pending_post(row_id: int) -> dict:
    db = SessionLocal()
    try:
        row = db.query(ProcessedPost).get(row_id)
        if not row or row.status != "pending_review":
            return {"ok": False, "message": "پست یافت نشد یا قبلاً پردازش شده"}
        if not row.source_channel_id:
            return {"ok": False, "message": "کانال مبدا نامعتبر است"}

        payload = json.loads(row.payload) if row.payload else {}
        if "media_items" in payload:
            await publish_album(db, row.id, row.purpose, row.rewritten_text or "", payload["media_items"], row.source_channel_id)
        else:
            await publish_single(db, row.id, row.purpose, row.rewritten_text or "", payload.get("media"), row.source_channel_id)
        return {"ok": True}
    finally:
        db.close()


def reject_pending_post(row_id: int) -> dict:
    db = SessionLocal()
    try:
        _finalize(db, row_id, status="rejected", reason="رد شده توسط ادمین")
        return {"ok": True}
    finally:
        db.close()
