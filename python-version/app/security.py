import hmac
import secrets

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.requests import Request

from app.config import SECRET_KEY, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS

_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="ff-admin-session")


def check_password(password: str, expected: str) -> bool:
    if not expected:
        return False
    return hmac.compare_digest(password, expected)


def create_session_token() -> str:
    return _serializer.dumps({"user": "admin", "nonce": secrets.token_hex(8)})


def verify_session_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return isinstance(data, dict) and data.get("user") == "admin"


def is_authenticated(request: Request) -> bool:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    return verify_session_token(token)
