"""SQLAlchemy models (SQLite).

Sensitive note: Account.encrypted_token is encrypted with Fernet before it
ever touches the database. It is decrypted only in memory, server-side, when
making Twilio API calls -- it is never returned by the API.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _utcnow():
    return datetime.now(timezone.utc)


class Account(Base):
    """A Twilio account (Account SID + encrypted auth token)."""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    label = Column(String(120), nullable=False, default="Twilio")
    account_sid = Column(String(64), nullable=False)
    encrypted_token = Column(Text, nullable=False)
    # Browser calling uses short-lived Access Tokens. Twilio requires those
    # tokens to be signed with an API key (never the account auth token) and
    # tied to a TwiML Application. The secret is encrypted with the same
    # Fernet key as the account auth token.
    api_key_sid = Column(String(64), default="", nullable=False)
    encrypted_api_secret = Column(Text, default="", nullable=False)
    twiml_app_sid = Column(String(64), default="", nullable=False)
    voice_identity = Column(String(121), default="backoffice", nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    numbers = relationship("PhoneNumberCache", back_populates="account",
                           cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="account")


class PhoneNumberCache(Base):
    """Local cache of a Twilio incoming phone number, plus local flags."""
    __tablename__ = "phone_numbers"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    number_sid = Column(String(64), nullable=False)          # Twilio PN sid
    phone_number = Column(String(32), nullable=False)       # E.164, e.g. +16025551234
    sms_capable = Column(Boolean, default=False, nullable=False)
    voice_capable = Column(Boolean, default=False, nullable=False)
    is_default_sender = Column(Boolean, default=False, nullable=False)
    webhook_applied = Column(Boolean, default=False, nullable=False)
    synced_at = Column(DateTime, default=_utcnow, nullable=False)

    account = relationship("Account", back_populates="numbers")


class NumberSettings(Base):
    """Per-number behavior: auto-reply, forwarding, recording, voicemail."""
    __tablename__ = "number_settings"

    id = Column(Integer, primary_key=True)
    phone_number = Column(String(32), unique=True, nullable=False)

    auto_reply_enabled = Column(Boolean, default=False, nullable=False)
    auto_reply_text = Column(Text, default="", nullable=False)

    forwarding_enabled = Column(Boolean, default=False, nullable=False)
    forward_to = Column(String(32), default="", nullable=False)
    record_calls = Column(Boolean, default=False, nullable=False)
    browser_ringing_enabled = Column(Boolean, default=False, nullable=False)

    missed_call_alert = Column(Boolean, default=False, nullable=False)
    alert_notify_number = Column(String(32), default="", nullable=False)

    voicemail_enabled = Column(Boolean, default=False, nullable=False)
    voicemail_greeting = Column(
        Text,
        default="Sorry, I'm not available. Please leave a message after the beep.",
        nullable=False,
    )


class Campaign(Base):
    """A bulk SMS/MMS campaign."""
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    from_number = Column(String(32), nullable=False)
    message = Column(Text, nullable=False, default="")
    media_urls = Column(Text, default="[]", nullable=False)  # JSON list of URLs
    rate_per_sec = Column(Float, default=1.0, nullable=False)
    # draft -> running -> done | cancelled | interrupted
    status = Column(String(32), default="draft", nullable=False)
    total = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    launched_at = Column(DateTime, nullable=True)

    account = relationship("Account", back_populates="campaigns")
    recipients = relationship("CampaignRecipient", back_populates="campaign",
                              cascade="all, delete-orphan")


class CampaignRecipient(Base):
    """One destination number inside a campaign."""
    __tablename__ = "campaign_recipients"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    to_number = Column(String(32), nullable=False)
    twilio_sid = Column(String(64), default="", nullable=False)
    # pending | queued | sent | delivered | failed | undelivered
    status = Column(String(32), default="pending", nullable=False)
    error = Column(Text, default="", nullable=False)
    updated_at = Column(DateTime, default=_utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="recipients")


class InboundMessage(Base):
    """Log of inbound SMS received on our numbers."""
    __tablename__ = "inbound_messages"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    from_number = Column(String(32), nullable=False)
    to_number = Column(String(32), nullable=False)
    body = Column(Text, default="", nullable=False)
    replied = Column(Boolean, default=False, nullable=False)
    received_at = Column(DateTime, default=_utcnow, nullable=False)


class Voicemail(Base):
    """A voicemail left via the /webhooks/voice -> <Record> flow."""
    __tablename__ = "voicemails"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    number = Column(String(32), nullable=False)        # our number that was called
    from_number = Column(String(32), nullable=False)  # caller
    recording_url = Column(Text, default="", nullable=False)  # Twilio URL (server-side only)
    recording_sid = Column(String(64), default="", nullable=False)
    transcription = Column(Text, default="", nullable=False)
    listened = Column(Boolean, default=False, nullable=False)
    received_at = Column(DateTime, default=_utcnow, nullable=False)


class AppSetting(Base):
    """Simple key/value store for global settings."""
    __tablename__ = "app_settings"

    key = Column(String(64), primary_key=True)
    value = Column(Text, default="", nullable=False)
