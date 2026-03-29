import re
import os
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from fastapi import HTTPException
from jose import JWTError, jwt

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def _prehash(plain: str) -> bytes:
    """SHA-256 prehash so passwords >72 bytes work safely with bcrypt."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest().encode("utf-8")

US_STATES = {
    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
    "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
}

# Matches .edu, .ac.uk, .edu.au, .ac.in, .ac.nz, .edu.sg, and generic .ac.XX / .edu.XX
_EDU_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@"
    r"[a-zA-Z0-9.\-]+"
    r"\."
    r"(?:edu|ac\.[a-z]{2}|edu\.[a-z]{2})"
    r"$"
)


def validate_edu_email(email: str) -> bool:
    """Return True if email looks like an institutional/edu address."""
    if not email or len(email) > 254:
        return False
    return bool(_EDU_PATTERN.match(email))


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prehash(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(plain), hashed.encode("utf-8"))


def create_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Field validation helpers — raise HTTPException on failure
# ---------------------------------------------------------------------------

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")
_DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9 '\-]{2,50}$")


def validate_username(username: str) -> None:
    if not username or not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=422,
            detail=(
                "Username must be 3–30 characters and contain only "
                "letters, numbers, or underscores."
            ),
        )


def validate_display_name(display_name: str) -> None:
    if not display_name or not _DISPLAY_NAME_RE.match(display_name):
        raise HTTPException(
            status_code=422,
            detail=(
                "Display name must be 2–50 characters and contain only "
                "letters, numbers, spaces, apostrophes, or hyphens."
            ),
        )


def validate_password(password: str) -> None:
    if not password:
        raise HTTPException(status_code=422, detail="Password is required.")
    if len(password) < 8 or len(password) > 128:
        raise HTTPException(
            status_code=422,
            detail="Password must be between 8 and 128 characters.",
        )
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not has_letter or not has_digit:
        raise HTTPException(
            status_code=422,
            detail="Password must contain at least one letter and one number.",
        )


def validate_state(state: str) -> None:
    if state not in US_STATES:
        raise HTTPException(
            status_code=422,
            detail=f"'{state}' is not a recognised US state. Please use a full state name.",
        )
