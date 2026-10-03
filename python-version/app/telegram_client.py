"""Thin convenience layer around aiogram's Bot class.

A fresh aiogram ``Bot`` instance is created per call (and its aiohttp session
is always closed afterwards) because the bot token is dynamic — it lives in
the database and can be changed at any time from the admin panel.
"""

from contextlib import asynccontextmanager
from typing import Optional

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.media_group import MediaGroupBuilder


@asynccontextmanager
async def bot_session(token: str):
    bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        yield bot
    finally:
        await bot.session.close()


def build_inline_keyboard(text: Optional[str], url: Optional[str]) -> Optional[InlineKeyboardMarkup]:
    if not text or not url:
        return None
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=text, url=url)]])


class TelegramResult:
    def __init__(self, ok: bool, result=None, error: str = ""):
        self.ok = ok
        self.result = result
        self.error = error


async def get_me(token: str) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            me = await bot.get_me()
            return TelegramResult(True, me)
    except TelegramAPIError as exc:
        return TelegramResult(False, error=str(exc))
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def set_webhook(token: str, url: str, secret: str) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            ok = await bot.set_webhook(
                url=url,
                secret_token=secret,
                allowed_updates=["message", "channel_post", "edited_channel_post"],
                drop_pending_updates=False,
            )
            return TelegramResult(bool(ok))
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def delete_webhook(token: str) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            ok = await bot.delete_webhook()
            return TelegramResult(bool(ok))
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def get_webhook_info(token: str) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            info = await bot.get_webhook_info()
            return TelegramResult(True, info)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def send_test_message(token: str, chat_id: str, text: str) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            msg = await bot.send_message(chat_id=chat_id, text=text)
            return TelegramResult(True, msg)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def publish_text(token: str, chat_id: str, text: str, keyboard=None, disable_preview=False) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            msg = await bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=keyboard,
                link_preview_options={"is_disabled": disable_preview} if disable_preview else None,
            )
            return TelegramResult(True, msg)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def publish_photo(token: str, chat_id: str, file_id: str, caption: str, keyboard=None) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            msg = await bot.send_photo(chat_id=chat_id, photo=file_id, caption=caption, reply_markup=keyboard)
            return TelegramResult(True, msg)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def publish_video(token: str, chat_id: str, file_id: str, caption: str, keyboard=None) -> TelegramResult:
    try:
        async with bot_session(token) as bot:
            msg = await bot.send_video(chat_id=chat_id, video=file_id, caption=caption, reply_markup=keyboard)
            return TelegramResult(True, msg)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))


async def publish_media_group(token: str, chat_id: str, items: list[dict], caption: str) -> TelegramResult:
    """items: [{"type": "photo"|"video", "file_id": "..."}, ...]"""
    try:
        builder = MediaGroupBuilder(caption=caption)
        for item in items:
            if item["type"] == "photo":
                builder.add_photo(media=item["file_id"])
            else:
                builder.add_video(media=item["file_id"])
        async with bot_session(token) as bot:
            messages = await bot.send_media_group(chat_id=chat_id, media=builder.build())
            return TelegramResult(True, messages)
    except Exception as exc:  # noqa: BLE001
        return TelegramResult(False, error=str(exc))
