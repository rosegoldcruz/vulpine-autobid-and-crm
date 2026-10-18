"""Fernet encryption for Twilio auth tokens stored in SQLite.

The key comes from the ENCRYPTION_KEY env var. If it is missing, an ephemeral
key is generated at boot and a warning is logged -- encrypted values will not
survive a restart in that case, which is loud and intentional.
"""
import logging

from cryptography.fernet import Fernet, InvalidToken

from . import config

log = logging.getLogger("twilio-app.crypto")

_fernet: Fernet | None = None


def generate_key() -> str:
    """Generate a fresh Fernet key (for .env setup)."""
    return Fernet.generate_key().decode()


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        raw = (config.ENCRYPTION_KEY or "").strip()
        if not raw:
            log.warning(
                "ENCRYPTION_KEY is not set -- using an ephemeral key. "
                "Stored auth tokens will NOT survive a restart. "
                "Generate one with: python -c \"from cryptography.fernet import "
                "Fernet; print(Fernet.generate_key().decode())\""
            )
            _fernet = Fernet(Fernet.generate_key())
        else:
            _fernet = Fernet(raw.encode())
    return _fernet


def encrypt_token(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError(
            "Could not decrypt stored auth token -- ENCRYPTION_KEY may have changed."
        ) from exc


def mask(value: str, visible: int = 4) -> str:
    """Mask a secret for display, e.g. 'ACcb****' (like the reference app)."""
    if not value:
        return "****"
    return f"{value[:visible]}****"
