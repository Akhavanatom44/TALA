from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.database import Base


class BotSettings(Base):
    __tablename__ = "bot_settings"

    id = Column(Integer, primary_key=True)
    bot_token = Column(String, nullable=True)
    bot_username = Column(String, nullable=True)
    gemini_api_key = Column(String, nullable=True)
    gemini_model = Column(String, nullable=False, default="gemini-2.5-flash")
    webhook_secret = Column(String, nullable=True)
    public_base_url = Column(String, nullable=True)
    freefire_prompt = Column(Text, nullable=True)
    gold_prompt = Column(Text, nullable=True)
    blacklist_keywords = Column(Text, nullable=True)
    auto_publish_freefire = Column(Boolean, nullable=False, default=True)
    auto_publish_gold = Column(Boolean, nullable=False, default=True)
    min_post_interval_seconds = Column(Integer, nullable=False, default=0)
    last_posted_at_freefire = Column(DateTime, nullable=True)
    last_posted_at_gold = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DestinationChannel(Base):
    __tablename__ = "destination_channels"

    id = Column(Integer, primary_key=True)
    purpose = Column(String, nullable=False)  # "freefire" | "gold"
    chat_id = Column(String, nullable=False)
    title = Column(String, nullable=True)
    footer_text = Column(Text, nullable=True)
    button_text = Column(String, nullable=True)
    button_url = Column(String, nullable=True)
    disable_link_preview = Column(Boolean, nullable=False, default=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SourceChannel(Base):
    __tablename__ = "source_channels"
    __table_args__ = (UniqueConstraint("chat_id", name="uq_source_channel_chat_id"),)

    id = Column(Integer, primary_key=True)
    purpose = Column(String, nullable=False)
    chat_id = Column(String, nullable=False)
    username = Column(String, nullable=True)
    title = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    total_seen = Column(Integer, nullable=False, default=0)
    total_posted = Column(Integer, nullable=False, default=0)
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessedPost(Base):
    __tablename__ = "processed_posts"
    __table_args__ = (
        UniqueConstraint("source_channel_id", "source_message_id", name="uq_processed_post_dedup"),
    )

    id = Column(Integer, primary_key=True)
    source_channel_id = Column(Integer, ForeignKey("source_channels.id", ondelete="CASCADE"), nullable=True)
    source_message_id = Column(Integer, nullable=False)
    media_group_id = Column(String, nullable=True)
    purpose = Column(String, nullable=False)
    original_text = Column(Text, nullable=True)
    rewritten_text = Column(Text, nullable=True)
    media_type = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending_review")
    reason = Column(Text, nullable=True)
    destination_chat_id = Column(String, nullable=True)
    destination_message_id = Column(String, nullable=True)
    payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
