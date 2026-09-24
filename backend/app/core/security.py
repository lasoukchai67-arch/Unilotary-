import hmac
import hashlib
import base64
import json
import time
from typing import Dict, Any, Optional
from app.core.config import settings


def hash_pin(pin: str) -> str:
    """Hashes a PIN or password with HMAC-SHA256 and system secret salt."""
    key = settings.SECRET_KEY.encode("utf-8")
    h = hmac.new(key, pin.encode("utf-8"), hashlib.sha256)
    return h.hexdigest()


def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Verifies plain PIN against hash using constant time comparison."""
    return hmac.compare_digest(hash_pin(plain_pin), hashed_pin)


def create_access_token(data: Dict[str, Any], expires_delta_seconds: Optional[int] = None) -> str:
    """Generates standard HMAC-SHA256 JWT-compatible access token without heavy external C dependencies."""
    to_encode = data.copy()
    now = int(time.time())
    expire = now + (expires_delta_seconds or (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    to_encode.update({"iat": now, "exp": expire})

    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    encoded_payload = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")

    signature_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), signature_input, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates token signature and expiration."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        encoded_header, encoded_payload, encoded_signature = parts

        signature_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), signature_input, hashlib.sha256).digest()

        # Re-add padding for base64 decode
        padded_sig = encoded_signature + "=" * (-len(encoded_signature) % 4)
        actual_sig = base64.urlsafe_b64decode(padded_sig.encode())

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        padded_payload = encoded_payload + "=" * (-len(encoded_payload) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded_payload.encode()).decode())

        if payload.get("exp", 0) < int(time.time()):
            return None  # Token expired

        return payload
    except Exception:
        return None
