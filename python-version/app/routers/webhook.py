import asyncio

from fastapi import APIRouter, Header, Request

from app.database import SessionLocal
from app.engine import handle_channel_post
from app.settings_service import get_settings
from app.telegram_client import send_test_message

router = APIRouter()


@router.get("/telegram/webhook")
async def webhook_alive():
    return {"ok": True, "message": "Telegram webhook endpoint is alive."}


@router.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        settings = get_settings(db)
        secret = settings.webhook_secret
        bot_token = settings.bot_token
    finally:
        db.close()

    if secret and x_telegram_bot_api_secret_token != secret:
        return {"ok": False, "error": "invalid secret token"}

    try:
        update = await request.json()
    except Exception:  # noqa: BLE001
        return {"ok": True}

    post = update.get("channel_post") or update.get("edited_channel_post")
    if post:
        asyncio.create_task(handle_channel_post(post))
    elif update.get("message") and bot_token:
        asyncio.create_task(_handle_private_message(bot_token, update["message"]))

    return {"ok": True}


async def _handle_private_message(bot_token: str, message: dict) -> None:
    chat = message.get("chat", {})
    if chat.get("type") != "private":
        return
    text = (message.get("text") or "").strip().lower()
    if text in ("/start", "/status", "/help"):
        await send_test_message(
            bot_token,
            chat["id"],
            "👋 سلام!\nاین ربات به صورت خودکار پست‌های کانال‌های منبع را بررسی و در صورت مرتبط بودن با "
            "موضوع، بازنویسی‌شده در کانال مقصد منتشر می‌کند.\n\nمدیریت تنظیمات از طریق پنل ادمین وب انجام می‌شود.",
        )
