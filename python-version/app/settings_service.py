import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from app.gemini_client import DEFAULT_FREEFIRE_PROMPT, DEFAULT_GOLD_PROMPT
from app.models import BotSettings


def get_settings(db: Session) -> BotSettings:
    row = db.query(BotSettings).first()
    if row:
        return row

    row = BotSettings(
        gemini_model="gemini-2.5-flash",
        webhook_secret=secrets.token_hex(24),
        freefire_prompt=DEFAULT_FREEFIRE_PROMPT,
        gold_prompt=DEFAULT_GOLD_PROMPT,
        auto_publish_freefire=True,
        auto_publish_gold=True,
        min_post_interval_seconds=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_settings(db: Session, **patch) -> BotSettings:
    row = get_settings(db)
    for key, value in patch.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row
