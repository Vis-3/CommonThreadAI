import json
import re
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from auth import (
    create_token,
    decode_token,
    hash_password,
    validate_display_name,
    validate_edu_email,
    validate_password,
    validate_state,
    validate_username,
    verify_password,
)
from blind_spot import surface_blind_spots
from bridge_mapper import get_bridge_recommendations
from chat import manager
from db import (
    create_user,
    get_conversations_for_user,
    get_messages,
    get_or_create_conversation,
    get_user_by_id,
    get_user_by_username,
    init_db,
    save_dna_profile,
    save_message,
)
from dna_extractor import extract_dna
from matcher import find_matches

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="CommonThread API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def _safe_user(user: dict) -> dict:
    """Strip sensitive fields before returning to client."""
    return {k: v for k, v in user.items() if k != "hashed_password"}


# ---------------------------------------------------------------------------
# In-memory rate-limit store: user_id -> list of ISO timestamps (today)
# ---------------------------------------------------------------------------

_dna_rate_limit: dict[str, list[str]] = defaultdict(list)
_DNA_DAILY_LIMIT = 3

_TAG_RE = re.compile(r"^[a-zA-Z0-9 \-&',\.\(\)/]{2,100}$")
_MAX_TAGS_PER_CATEGORY = 10


def _check_dna_rate_limit(user_id: str) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    calls = [ts for ts in _dna_rate_limit[user_id] if ts.startswith(today)]
    _dna_rate_limit[user_id] = calls
    if len(calls) >= _DNA_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"DNA extraction is limited to {_DNA_DAILY_LIMIT} times per day.",
        )
    _dna_rate_limit[user_id].append(datetime.now(timezone.utc).isoformat())


def _validate_dna_tags(dna_profile: dict) -> None:
    list_keys = [
        "dominant_themes",
        "dominant_emotions",
        "aesthetic_signatures",
        "cultural_origins_detected",
        "taste_palette",
    ]
    for key in list_keys:
        tags = dna_profile.get(key, [])
        if not isinstance(tags, list):
            raise HTTPException(
                status_code=422, detail=f"'{key}' must be a list."
            )
        if len(tags) > _MAX_TAGS_PER_CATEGORY:
            raise HTTPException(
                status_code=422,
                detail=f"'{key}' may contain at most {_MAX_TAGS_PER_CATEGORY} tags.",
            )
        for tag in tags:
            if not isinstance(tag, str) or not _TAG_RE.match(tag):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Invalid tag '{tag}' in '{key}'. Tags must be 2–100 characters "
                        "using only letters, numbers, spaces, hyphens, or common punctuation."
                    ),
                )


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class RegisterBody(BaseModel):
    username: str
    display_name: str
    email: str
    password: str
    state: str


class LoginBody(BaseModel):
    username: str
    password: str


class ExtractDNABody(BaseModel):
    youtube_titles: list[str] = []
    movies: list[str] = []
    music: list[str] = []
    books: list[str] = []
    food: list[str] = []


class VerifyDNABody(BaseModel):
    dna_profile: dict
    source: str = "extracted"


class PatchDNABody(BaseModel):
    dna_profile: dict


class BridgeBody(BaseModel):
    dna: dict
    target_culture: str = ""


class BlindSpotsBody(BaseModel):
    dna: dict


class MatchBody(BaseModel):
    dna: dict


class ConversationBody(BaseModel):
    other_user_id: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/register")
async def register(body: RegisterBody):
    validate_username(body.username)
    validate_display_name(body.display_name)
    validate_password(body.password)
    validate_state(body.state)

    if not validate_edu_email(body.email):
        raise HTTPException(
            status_code=422,
            detail="A valid institutional email address (.edu, .ac.uk, etc.) is required.",
        )

    # Check for duplicates
    existing = await get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    hashed = hash_password(body.password)
    try:
        user = await create_user(
            username=body.username,
            display_name=body.display_name,
            email=body.email,
            hashed_password=hashed,
            state=body.state,
        )
    except Exception as exc:
        if "UNIQUE constraint failed: users.email" in str(exc):
            raise HTTPException(status_code=409, detail="Email already registered.")
        raise HTTPException(status_code=500, detail="Could not create account.")

    token = create_token(user["id"], user["username"])
    return {"token": token, "user": _safe_user(user)}


@app.post("/api/login")
async def login(body: LoginBody):
    user = await get_user_by_username(body.username)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_token(user["id"], user["username"])
    return {"token": token, "user": _safe_user(user)}


@app.get("/api/me")
async def me(current_user: dict = Depends(get_current_user)):
    return _safe_user(current_user)


@app.post("/api/extract-dna")
async def api_extract_dna(
    body: ExtractDNABody,
    current_user: dict = Depends(get_current_user),
):
    _check_dna_rate_limit(current_user["id"])
    try:
        dna = await extract_dna(
            {
                "youtube_titles": body.youtube_titles,
                "movies": body.movies,
                "music": body.music,
                "books": body.books,
                "food": body.food,
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return dna


@app.post("/api/verify-dna")
async def api_verify_dna(
    body: VerifyDNABody,
    current_user: dict = Depends(get_current_user),
):
    if body.source not in ("extracted", "verified_edit"):
        raise HTTPException(
            status_code=422, detail="source must be 'extracted' or 'verified_edit'."
        )
    _validate_dna_tags(body.dna_profile)
    updated_user = await save_dna_profile(
        user_id=current_user["id"],
        profile=body.dna_profile,
        source=body.source,
    )
    return {"success": True, "dna_profile": body.dna_profile, "user": _safe_user(updated_user)}


@app.patch("/api/users/me/dna")
async def patch_dna(
    body: PatchDNABody,
    current_user: dict = Depends(get_current_user),
):
    _validate_dna_tags(body.dna_profile)
    updated_user = await save_dna_profile(
        user_id=current_user["id"],
        profile=body.dna_profile,
        source="verified_edit",
    )
    return {"success": True, "dna_profile": body.dna_profile, "user": _safe_user(updated_user)}


@app.post("/api/bridge")
async def api_bridge(
    body: BridgeBody,
    current_user: dict = Depends(get_current_user),
):
    user_state = current_user.get("state", "")
    recommendations = await get_bridge_recommendations(body.dna, user_state)
    return {"recommendations": recommendations}


@app.post("/api/blindspots")
async def api_blind_spots(
    body: BlindSpotsBody,
    current_user: dict = Depends(get_current_user),
):
    spots = await surface_blind_spots(body.dna)
    return {"blind_spots": spots}


@app.post("/api/match")
async def api_match(
    body: MatchBody,
    current_user: dict = Depends(get_current_user),
):
    matches = await find_matches(current_user["id"], body.dna)
    return {"matches": matches}


@app.post("/api/conversations")
async def api_create_conversation(
    body: ConversationBody,
    current_user: dict = Depends(get_current_user),
):
    conversation = await get_or_create_conversation(
        current_user["id"], body.other_user_id
    )
    return {"conversation_id": conversation["id"]}


@app.get("/api/conversations")
async def api_list_conversations(
    current_user: dict = Depends(get_current_user),
):
    convos = await get_conversations_for_user(current_user["id"])
    return {"conversations": convos}


@app.get("/api/conversations/{conversation_id}/messages")
async def api_get_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    messages = await get_messages(conversation_id, limit=50)
    return {"messages": messages}


# ---------------------------------------------------------------------------
# WebSocket chat
# ---------------------------------------------------------------------------


@app.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str, token: str = ""):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user = await get_user_by_id(payload["sub"])
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, conversation_id)
    try:
        while True:
            data = await websocket.receive_text()
            content = data.strip()
            if not content:
                continue

            # Frontend sends a JSON envelope — extract just the text content
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "content" in parsed:
                    content = str(parsed["content"]).strip()
            except (json.JSONDecodeError, TypeError):
                pass  # plain text — use as-is

            if not content:
                continue

            msg = await save_message(
                conversation_id=conversation_id,
                sender_id=user["id"],
                content=content,
            )

            broadcast_payload = {
                "message_id": msg["id"],
                "sender_id": user["id"],
                "sender_name": user["display_name"],
                "content": msg["content"],
                "created_at": msg["created_at"],
            }
            await manager.broadcast(broadcast_payload, conversation_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
