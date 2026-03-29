"""
Encryption module for DafGram.

Provides symmetric encryption/decryption using Fernet (AES-128-CBC with HMAC)
and a SQLAlchemy TypeDecorator for transparent column-level encryption.
"""

import logging
import os
import warnings

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Key management
# ---------------------------------------------------------------------------

_ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

if not _ENCRYPTION_KEY:
    warnings.warn(
        "ENCRYPTION_KEY is not set. Generating an ephemeral key for development. "
        "Data encrypted with this key will NOT be recoverable after restart. "
        "Set a persistent ENCRYPTION_KEY environment variable in production.",
        stacklevel=2,
    )
    _ENCRYPTION_KEY = Fernet.generate_key().decode()

_fernet = Fernet(_ENCRYPTION_KEY.encode() if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY)

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def encrypt_value(plaintext: str | None) -> str | None:
    """Encrypt a plaintext string and return the Fernet token as a string.

    Returns ``None`` when *plaintext* is ``None``.
    """
    if plaintext is None:
        return None
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str | None) -> str | None:
    """Decrypt a Fernet token back to its plaintext string.

    Returns ``None`` when *ciphertext* is ``None``.
    If *ciphertext* is not a valid Fernet token (e.g. already decrypted or
    corrupted), the original value is returned unchanged so that callers
    never lose data.
    """
    if ciphertext is None:
        return None
    try:
        return _fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        logger.debug(
            "decrypt_value: could not decrypt value (may already be plaintext); "
            "returning original value."
        )
        return ciphertext


# ---------------------------------------------------------------------------
# SQLAlchemy TypeDecorator
# ---------------------------------------------------------------------------


class EncryptedString(TypeDecorator):
    """A SQLAlchemy column type that transparently encrypts on write and
    decrypts on read using Fernet symmetric encryption.

    Usage::

        class Secret(Base):
            __tablename__ = "secrets"
            id = Column(Integer, primary_key=True)
            value = Column(EncryptedString(length=512))
    """

    impl = String
    cache_ok = True

    def __init__(self, length: int = 512, **kwargs):
        # Encrypted tokens are longer than the plaintext; callers should
        # size the column accordingly.
        super().__init__(length=length, **kwargs)

    def process_bind_param(self, value, dialect):
        """Encrypt the value before storing it in the database."""
        return encrypt_value(value)

    def process_result_value(self, value, dialect):
        """Decrypt the value when reading it from the database."""
        return decrypt_value(value)
