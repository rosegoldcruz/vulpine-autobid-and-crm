"""Accounts CRUD + connection testing.

The auth token is accepted on create/update but NEVER returned by the API --
list/detail responses carry only a masked hint (first 4 chars, e.g. ACcb****).
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import twilio_client
from ..auth import get_current_admin
from ..crypto import encrypt_token, mask
from ..db import get_db
from ..models import Account

log = logging.getLogger("twilio-app.accounts")

router = APIRouter(
    prefix="/api/accounts",
    tags=["accounts"],
    dependencies=[Depends(get_current_admin)],
)


class AccountIn(BaseModel):
    label: str = Field(default="Twilio", max_length=120)
    account_sid: str = Field(min_length=2, max_length=64)
    auth_token: str = Field(min_length=2, max_length=128)
    api_key_sid: str = Field(default="", max_length=64)
    api_key_secret: str = Field(default="", max_length=128)
    twiml_app_sid: str = Field(default="", max_length=64)
    is_default: bool = False


class AccountUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    auth_token: str | None = Field(default=None, max_length=128)
    api_key_sid: str | None = Field(default=None, max_length=64)
    api_key_secret: str | None = Field(default=None, max_length=128)
    twiml_app_sid: str | None = Field(default=None, max_length=64)
    is_default: bool | None = None


def _public(acct: Account) -> dict:
    # NOTE: the full account SID is intentionally NOT returned -- the UI only
    # ever needs the masked hint. The real SID lives server-side in the DB.
    return {
        "id": acct.id,
        "label": acct.label,
        "account_sid_masked": mask(acct.account_sid),
        "auth_token_masked": mask(decrypt_hint(acct)),
        "voice_configured": bool(
            acct.api_key_sid and acct.encrypted_api_secret and acct.twiml_app_sid
        ),
        "api_key_sid_masked": mask(acct.api_key_sid),
        "twiml_app_sid_masked": mask(acct.twiml_app_sid),
        "is_default": acct.is_default,
        "created_at": acct.created_at.isoformat() if acct.created_at else None,
    }


def decrypt_hint(acct: Account) -> str:
    # Only used to derive the masked display; the plaintext never leaves.
    from ..crypto import decrypt_token
    try:
        return decrypt_token(acct.encrypted_token)
    except ValueError:
        return ""


def _ensure_single_default(db: Session, acct: Account) -> None:
    if acct.is_default:
        db.query(Account).filter(Account.id != acct.id).update({"is_default": False})


@router.get("")
def list_accounts(db: Session = Depends(get_db)):
    return [_public(a) for a in db.query(Account).order_by(Account.id).all()]


@router.post("")
def create_account(payload: AccountIn, db: Session = Depends(get_db)):
    acct = Account(
        label=payload.label.strip() or "Twilio",
        account_sid=payload.account_sid.strip(),
        encrypted_token=encrypt_token(payload.auth_token.strip()),
        api_key_sid=payload.api_key_sid.strip(),
        encrypted_api_secret=(
            encrypt_token(payload.api_key_secret.strip())
            if payload.api_key_secret.strip() else ""
        ),
        twiml_app_sid=payload.twiml_app_sid.strip(),
        is_default=payload.is_default,
    )
    db.add(acct)
    db.flush()
    if payload.is_default:
        _ensure_single_default(db, acct)
    elif db.query(Account).count() == 1:
        acct.is_default = True  # first account becomes the default
    db.commit()
    db.refresh(acct)
    return _public(acct)


@router.put("/{account_id}")
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    acct = db.get(Account, account_id)
    if acct is None:
        raise HTTPException(404, "Account not found")
    if payload.label is not None:
        acct.label = payload.label.strip() or acct.label
    if payload.auth_token:
        acct.encrypted_token = encrypt_token(payload.auth_token.strip())
    if payload.api_key_sid is not None:
        acct.api_key_sid = payload.api_key_sid.strip()
    if payload.api_key_secret:
        acct.encrypted_api_secret = encrypt_token(payload.api_key_secret.strip())
    if payload.twiml_app_sid is not None:
        acct.twiml_app_sid = payload.twiml_app_sid.strip()
    if payload.is_default is not None:
        acct.is_default = payload.is_default
        _ensure_single_default(db, acct)
    db.commit()
    db.refresh(acct)
    return _public(acct)


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(Account, account_id)
    if acct is None:
        raise HTTPException(404, "Account not found")
    db.delete(acct)
    db.commit()
    return {"ok": True}


@router.post("/{account_id}/test")
def test_connection(account_id: int, db: Session = Depends(get_db)):
    """Verify the stored credentials by fetching the Twilio account."""
    acct = db.get(Account, account_id)
    if acct is None:
        raise HTTPException(404, "Account not found")
    try:
        client = twilio_client.get_client(acct)
        tw_account = client.api.accounts(acct.account_sid).fetch()
        return {
            "ok": True,
            "friendly_name": tw_account.friendly_name,
            "status": tw_account.status,
            "type": tw_account.type,
        }
    except Exception as exc:  # noqa: BLE001 -- surfaced to the UI as-is
        log.warning("Test connection failed for account %s: %s", account_id, exc)
        return {"ok": False, "error": str(exc)[:500]}
