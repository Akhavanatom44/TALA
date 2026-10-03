from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import BASE_DIR, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS
from app.database import get_db
from app.engine import approve_pending_post, reject_pending_post
from app.models import DestinationChannel, ProcessedPost, SourceChannel
from app.security import check_password, create_session_token, is_authenticated
from app.settings_service import get_settings, update_settings
from app.telegram_client import delete_webhook, get_me, get_webhook_info, send_test_message, set_webhook

router = APIRouter()
templates = Jinja2Templates(directory=str(BASE_DIR / "app" / "templates"))

PURPOSE_LABELS = {
    "freefire": {"title": "🎮 کانال‌های فری‌فایر", "subtitle": "رصد پست‌های مرتبط با بازی Free Fire"},
    "gold": {"title": "🪙 کانال‌های قیمت طلا", "subtitle": "رصد پست‌های قیمت طلا، سکه و ارز"},
}

STATUS_LABELS = {
    "posted": ("منتشر شد", "bg-emerald-500/15 text-emerald-400"),
    "skipped": ("نامرتبط", "bg-slate-500/15 text-slate-300"),
    "error": ("خطا", "bg-rose-500/15 text-rose-400"),
    "pending_review": ("در انتظار تایید", "bg-amber-500/15 text-amber-400"),
    "rejected": ("رد شده", "bg-slate-600/15 text-slate-400"),
}


def require_login(request: Request):
    if not is_authenticated(request):
        return RedirectResponse("/admin/login", status_code=303)
    return None


def redirect_with_message(url: str, ok: bool, message: str) -> RedirectResponse:
    sep = "&" if "?" in url else "?"
    return RedirectResponse(f"{url}{sep}ok={'1' if ok else '0'}&msg={quote(message)}", status_code=303)


# ---------- Auth ----------


@router.get("/admin/login")
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error": request.query_params.get("error")})


@router.post("/admin/login")
async def login_submit(request: Request):
    form = await request.form()
    password = str(form.get("password") or "")
    settings_db = next(get_db())
    try:
        expected = __import__("os").environ.get("ADMIN_PASSWORD", "")
    finally:
        settings_db.close()

    if not check_password(password, expected):
        return RedirectResponse("/admin/login?error=1", status_code=303)

    response = RedirectResponse("/admin", status_code=303)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        create_session_token(),
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
    )
    return response


@router.post("/admin/logout")
async def logout(request: Request):
    response = RedirectResponse("/admin/login", status_code=303)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response


# ---------- Dashboard ----------


@router.get("/admin")
async def dashboard(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard

    settings = get_settings(db)

    def count(**filters):
        q = db.query(func.count(ProcessedPost.id))
        for k, v in filters.items():
            q = q.filter(getattr(ProcessedPost, k) == v)
        return q.scalar() or 0

    bot_status = {"connected": False, "username": None}
    webhook_status = {"configured": False, "last_error": None}
    if settings.bot_token:
        me = await get_me(settings.bot_token)
        if me.ok and me.result:
            bot_status = {"connected": True, "username": me.result.username}
        info = await get_webhook_info(settings.bot_token)
        if info.ok and info.result:
            webhook_status = {
                "configured": bool(info.result.url),
                "last_error": info.result.last_error_message,
            }

    recent = db.query(ProcessedPost).order_by(ProcessedPost.created_at.desc()).limit(8).all()

    context = {
        "request": request,
        "active_nav": "dashboard",
        "bot_status": bot_status,
        "webhook_status": webhook_status,
        "posted_count": count(status="posted"),
        "skipped_count": count(status="skipped"),
        "error_count": count(status="error"),
        "pending_count": count(status="pending_review"),
        "freefire_source_count": db.query(func.count(SourceChannel.id)).filter(SourceChannel.purpose == "freefire").scalar() or 0,
        "gold_source_count": db.query(func.count(SourceChannel.id)).filter(SourceChannel.purpose == "gold").scalar() or 0,
        "destination_count": db.query(func.count(DestinationChannel.id)).scalar() or 0,
        "recent": recent,
        "status_labels": STATUS_LABELS,
    }
    return templates.TemplateResponse("dashboard.html", context)


# ---------- Settings ----------


@router.get("/admin/settings")
async def settings_page(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    settings = get_settings(db)
    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request,
            "active_nav": "settings",
            "settings": settings,
            "ok": request.query_params.get("ok"),
            "msg": request.query_params.get("msg"),
        },
    )


@router.post("/admin/settings")
async def settings_save(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    form = await request.form()
    update_settings(
        db,
        bot_token=str(form.get("bot_token") or "").strip() or None,
        gemini_api_key=str(form.get("gemini_api_key") or "").strip() or None,
        gemini_model=str(form.get("gemini_model") or "gemini-2.5-flash").strip(),
        public_base_url=str(form.get("public_base_url") or "").strip() or None,
        freefire_prompt=str(form.get("freefire_prompt") or "").strip() or None,
        gold_prompt=str(form.get("gold_prompt") or "").strip() or None,
        blacklist_keywords=str(form.get("blacklist_keywords") or "").strip(),
        min_post_interval_seconds=int(form.get("min_post_interval_seconds") or 0),
        auto_publish_freefire=form.get("auto_publish_freefire") == "on",
        auto_publish_gold=form.get("auto_publish_gold") == "on",
    )
    return redirect_with_message("/admin/settings", True, "تنظیمات ذخیره شد ✅")


@router.post("/admin/bot/test")
async def bot_test(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    settings = get_settings(db)
    if not settings.bot_token:
        return redirect_with_message("/admin/settings", False, "ابتدا توکن ربات را وارد کنید.")
    res = await get_me(settings.bot_token)
    if not res.ok:
        return redirect_with_message("/admin/settings", False, res.error or "اتصال ناموفق بود.")
    return redirect_with_message("/admin/settings", True, f"اتصال موفق ✅ ربات: @{res.result.username}")


@router.post("/admin/bot/webhook/enable")
async def webhook_enable(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    settings = get_settings(db)
    if not settings.bot_token or not settings.public_base_url:
        return redirect_with_message("/admin/settings", False, "توکن ربات و آدرس عمومی سایت را وارد کنید.")
    url = settings.public_base_url.rstrip("/") + "/telegram/webhook"
    res = await set_webhook(settings.bot_token, url, settings.webhook_secret)
    if not res.ok:
        return redirect_with_message("/admin/settings", False, res.error or "تنظیم وب‌هوک ناموفق بود.")
    return redirect_with_message("/admin/settings", True, f"وب‌هوک فعال شد روی {url}")


@router.post("/admin/bot/webhook/disable")
async def webhook_disable(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    settings = get_settings(db)
    if not settings.bot_token:
        return redirect_with_message("/admin/settings", False, "ابتدا توکن ربات را وارد کنید.")
    res = await delete_webhook(settings.bot_token)
    if not res.ok:
        return redirect_with_message("/admin/settings", False, res.error or "حذف ناموفق بود.")
    return redirect_with_message("/admin/settings", True, "وب‌هوک حذف شد.")


# ---------- Channels ----------


@router.get("/admin/channels/{purpose}")
async def channels_page(purpose: str, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    if purpose not in PURPOSE_LABELS:
        return RedirectResponse("/admin", status_code=303)

    sources = db.query(SourceChannel).filter(SourceChannel.purpose == purpose).order_by(SourceChannel.id).all()
    destinations = (
        db.query(DestinationChannel).filter(DestinationChannel.purpose == purpose).order_by(DestinationChannel.id).all()
    )

    return templates.TemplateResponse(
        "channels.html",
        {
            "request": request,
            "active_nav": f"channels_{purpose}",
            "purpose": purpose,
            "labels": PURPOSE_LABELS[purpose],
            "sources": sources,
            "destinations": destinations,
            "ok": request.query_params.get("ok"),
            "msg": request.query_params.get("msg"),
        },
    )


@router.post("/admin/channels/{purpose}/source/add")
async def add_source(purpose: str, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    form = await request.form()
    chat_id = str(form.get("chat_id") or "").strip()
    title = str(form.get("title") or "").strip()
    if chat_id:
        existing = db.query(SourceChannel).filter(SourceChannel.chat_id == chat_id).first()
        if not existing:
            db.add(
                SourceChannel(
                    purpose=purpose,
                    chat_id=chat_id,
                    title=title or chat_id,
                    username=chat_id.lstrip("@"),
                )
            )
            db.commit()
    return RedirectResponse(f"/admin/channels/{purpose}", status_code=303)


@router.post("/admin/channels/{purpose}/source/{source_id}/toggle")
async def toggle_source(purpose: str, source_id: int, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    row = db.query(SourceChannel).get(source_id)
    if row:
        row.active = not row.active
        db.commit()
    return RedirectResponse(f"/admin/channels/{purpose}", status_code=303)


@router.post("/admin/channels/{purpose}/source/{source_id}/delete")
async def delete_source(purpose: str, source_id: int, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    row = db.query(SourceChannel).get(source_id)
    if row:
        db.delete(row)
        db.commit()
    return RedirectResponse(f"/admin/channels/{purpose}", status_code=303)


@router.post("/admin/channels/{purpose}/destination/save")
async def save_destination(purpose: str, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    form = await request.form()
    chat_id = str(form.get("chat_id") or "").strip()
    existing_id = form.get("id")

    if existing_id:
        row = db.query(DestinationChannel).get(int(existing_id))
        if row:
            row.chat_id = chat_id
            row.title = str(form.get("title") or "").strip()
            row.footer_text = str(form.get("footer_text") or "").strip()
            row.button_text = str(form.get("button_text") or "").strip()
            row.button_url = str(form.get("button_url") or "").strip()
            row.disable_link_preview = form.get("disable_link_preview") == "on"
            db.commit()
    elif chat_id:
        db.add(
            DestinationChannel(
                purpose=purpose,
                chat_id=chat_id,
                title=str(form.get("title") or "").strip(),
                footer_text=str(form.get("footer_text") or "").strip(),
                button_text=str(form.get("button_text") or "").strip(),
                button_url=str(form.get("button_url") or "").strip(),
                disable_link_preview=form.get("disable_link_preview") == "on",
            )
        )
        db.commit()
    return RedirectResponse(f"/admin/channels/{purpose}", status_code=303)


@router.post("/admin/channels/{purpose}/destination/{dest_id}/delete")
async def delete_destination(purpose: str, dest_id: int, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    row = db.query(DestinationChannel).get(dest_id)
    if row:
        db.delete(row)
        db.commit()
    return RedirectResponse(f"/admin/channels/{purpose}", status_code=303)


@router.post("/admin/channels/{purpose}/destination/{dest_id}/test")
async def test_destination(purpose: str, dest_id: int, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    settings = get_settings(db)
    row = db.query(DestinationChannel).get(dest_id)
    if not settings.bot_token or not row:
        return redirect_with_message(f"/admin/channels/{purpose}", False, "توکن ربات یا کانال نامعتبر است.")
    res = await send_test_message(settings.bot_token, row.chat_id, "✅ این یک پیام آزمایشی برای بررسی اتصال ربات به این کانال است.")
    if not res.ok:
        return redirect_with_message(f"/admin/channels/{purpose}", False, res.error or "ارسال ناموفق بود.")
    return redirect_with_message(f"/admin/channels/{purpose}", True, "پیام آزمایشی ارسال شد ✅")


# ---------- Review queue ----------


@router.get("/admin/review")
async def review_page(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    rows = (
        db.query(ProcessedPost)
        .filter(ProcessedPost.status == "pending_review")
        .order_by(ProcessedPost.created_at.desc())
        .all()
    )
    enriched = []
    for row in rows:
        source = db.query(SourceChannel).get(row.source_channel_id) if row.source_channel_id else None
        enriched.append({"row": row, "source_title": source.title if source else "کانال نامشخص"})
    return templates.TemplateResponse(
        "review.html", {"request": request, "active_nav": "review", "items": enriched}
    )


@router.post("/admin/review/{row_id}/approve")
async def review_approve(row_id: int, request: Request):
    guard = require_login(request)
    if guard:
        return guard
    await approve_pending_post(row_id)
    return RedirectResponse("/admin/review", status_code=303)


@router.post("/admin/review/{row_id}/reject")
async def review_reject(row_id: int, request: Request):
    guard = require_login(request)
    if guard:
        return guard
    reject_pending_post(row_id)
    return RedirectResponse("/admin/review", status_code=303)


# ---------- Logs ----------


@router.get("/admin/logs")
async def logs_page(request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    status_filter = request.query_params.get("status")
    query = db.query(ProcessedPost)
    if status_filter:
        query = query.filter(ProcessedPost.status == status_filter)
    rows = query.order_by(ProcessedPost.created_at.desc()).limit(100).all()

    enriched = []
    for row in rows:
        source = db.query(SourceChannel).get(row.source_channel_id) if row.source_channel_id else None
        label, cls = STATUS_LABELS.get(row.status, (row.status, "bg-slate-500/15 text-slate-300"))
        enriched.append({"row": row, "source_title": source.title if source else "-", "label": label, "cls": cls})

    return templates.TemplateResponse(
        "logs.html",
        {"request": request, "active_nav": "logs", "items": enriched, "status_filter": status_filter},
    )


@router.post("/admin/logs/{row_id}/delete")
async def delete_log(row_id: int, request: Request, db: Session = Depends(get_db)):
    guard = require_login(request)
    if guard:
        return guard
    row = db.query(ProcessedPost).get(row_id)
    if row:
        db.delete(row)
        db.commit()
    return RedirectResponse("/admin/logs", status_code=303)
