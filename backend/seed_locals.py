"""
seed_locals.py — One-time setup script to populate simulated local profiles.

Usage:
    cd backend && python seed_locals.py

Safe to re-run: skips profiles that already have DNA and are already in ChromaDB.
"""

import asyncio
import json
import os
import sys
import uuid as uuid_module

import aiosqlite
import chromadb

from auth import hash_password
from db import DB_PATH
from dna_extractor import extract_dna

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HERE = os.path.dirname(__file__)
PROFILES_PATH = os.path.join(HERE, "local_profiles_indiana.json")
CHROMA_PATH = os.path.join(HERE, "chroma_db")
COLLECTION_NAME = "local_profiles"
API_CALL_GAP = 8  # seconds between Gemini API calls

_DUMMY_PASSWORD = hash_password("SIMULATED_LOCAL_NO_LOGIN_ACCOUNT")

# ---------------------------------------------------------------------------
# SQLite table
# ---------------------------------------------------------------------------

_CREATE_SIMULATED_LOCALS = """
CREATE TABLE IF NOT EXISTS simulated_locals (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    state       TEXT NOT NULL,
    type        TEXT NOT NULL,
    preferences TEXT NOT NULL,
    dna_profile TEXT,
    user_id     TEXT
);
"""


async def init_simulated_locals_table(db: aiosqlite.Connection) -> None:
    await db.execute(_CREATE_SIMULATED_LOCALS)
    # Add user_id column if this table already existed without it
    try:
        await db.execute("ALTER TABLE simulated_locals ADD COLUMN user_id TEXT")
    except Exception:
        pass  # column already exists
    await db.commit()


async def insert_profile_if_missing(db: aiosqlite.Connection, profile: dict) -> bool:
    """Insert profile row. Returns True if newly inserted, False if already exists."""
    async with db.execute(
        "SELECT id FROM simulated_locals WHERE id = ?", (profile["id"],)
    ) as cursor:
        existing = await cursor.fetchone()
    if existing:
        return False
    await db.execute(
        "INSERT INTO simulated_locals (id, email, state, type, preferences) VALUES (?, ?, ?, ?, ?)",
        (
            profile["id"],
            profile["email"],
            profile["state"],
            profile["type"],
            json.dumps(profile["preferences"]),
        ),
    )
    await db.commit()
    return True


async def get_dna_profile(db: aiosqlite.Connection, profile_id: str) -> dict | None:
    async with db.execute(
        "SELECT dna_profile FROM simulated_locals WHERE id = ?", (profile_id,)
    ) as cursor:
        row = await cursor.fetchone()
    if row and row[0]:
        return json.loads(row[0])
    return None


async def save_dna_to_local(
    db: aiosqlite.Connection, profile_id: str, dna: dict
) -> None:
    await db.execute(
        "UPDATE simulated_locals SET dna_profile = ? WHERE id = ?",
        (json.dumps(dna), profile_id),
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Users table helpers (for chat capability)
# ---------------------------------------------------------------------------

def _display_name_from_email(email: str) -> str:
    """'spalu002@iu.edu' → 'spalu002'"""
    return email.split("@")[0]


def _university_from_email(email: str) -> str:
    return email.split("@")[-1]


async def ensure_user_account(
    db: aiosqlite.Connection, profile: dict, dna: dict | None
) -> str:
    """
    Ensure a users row exists for this local profile.
    Returns the user_id (UUID).
    """
    # Check if already linked in simulated_locals
    async with db.execute(
        "SELECT user_id FROM simulated_locals WHERE id = ?", (profile["id"],)
    ) as cursor:
        row = await cursor.fetchone()
    if row and row[0]:
        return row[0]

    # Check if a user with this email already exists
    async with db.execute(
        "SELECT id FROM users WHERE email = ?", (profile["email"],)
    ) as cursor:
        existing = await cursor.fetchone()
    if existing:
        user_id = existing[0]
    else:
        user_id = str(uuid_module.uuid4())
        username = f"local_{profile['id']}"
        display_name = _display_name_from_email(profile["email"])
        university = _university_from_email(profile["email"])
        from datetime import datetime, timezone
        created_at = datetime.now(timezone.utc).isoformat()

        await db.execute(
            """
            INSERT INTO users
                (id, username, display_name, email, hashed_password,
                 state, university, dna_profile, dna_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                user_id,
                username,
                display_name,
                profile["email"],
                _DUMMY_PASSWORD,
                profile["state"],
                university,
                json.dumps(dna) if dna else None,
                created_at,
            ),
        )

    # Link back to simulated_locals
    await db.execute(
        "UPDATE simulated_locals SET user_id = ? WHERE id = ?",
        (user_id, profile["id"]),
    )
    await db.commit()
    return user_id


async def sync_dna_to_user(
    db: aiosqlite.Connection, user_id: str, dna: dict
) -> None:
    """Keep the users.dna_profile in sync when DNA is extracted after user creation."""
    await db.execute(
        "UPDATE users SET dna_profile = ?, dna_verified = 1 WHERE id = ?",
        (json.dumps(dna), user_id),
    )
    await db.commit()


# ---------------------------------------------------------------------------
# DNA extraction helpers
# ---------------------------------------------------------------------------

def build_extractor_input(preferences: dict) -> dict:
    return {
        "youtube_titles": preferences.get("youtube", []),
        "movies": preferences.get("films", []),
        "music": preferences.get("artists_music", []),
        "books": preferences.get("books", []),
        "food": preferences.get("local_scene", []),
    }


def dna_to_embedding_text(dna: dict) -> str:
    """Concatenate all DNA categories into a single text for embedding."""
    parts = (
        dna.get("dominant_themes", [])
        + dna.get("dominant_emotions", [])
        + dna.get("aesthetic_signatures", [])
        + dna.get("cultural_origins_detected", [])
        + dna.get("taste_palette", [])
    )
    return ", ".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    # Load profiles
    with open(PROFILES_PATH, "r") as f:
        data = json.load(f)
    profiles = data["users"]
    print(f"[seed] Loaded {len(profiles)} profiles from {PROFILES_PATH}")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await init_simulated_locals_table(db)
        print("[seed] simulated_locals table ready")

        # ── Phase 1: Insert simulated_locals rows + extract DNA ──────────────
        profiles_needing_dna = []
        for profile in profiles:
            inserted = await insert_profile_if_missing(db, profile)
            if inserted:
                print(f"  [db] Inserted {profile['id']} ({profile['email']})")
            else:
                print(f"  [db] {profile['id']} already in DB — skipping insert")

            existing_dna = await get_dna_profile(db, profile["id"])
            if existing_dna:
                print(f"  [dna] {profile['id']} already has DNA — skipping extraction")
            else:
                profiles_needing_dna.append(profile)

        print(f"\n[seed] {len(profiles_needing_dna)} profiles need DNA extraction")

        first_call = True
        for i, profile in enumerate(profiles_needing_dna):
            pid = profile["id"]
            print(f"\n[dna] Extracting DNA for {pid} ({i+1}/{len(profiles_needing_dna)})...")

            if not first_call:
                print(f"  [rate-limit] Waiting {API_CALL_GAP}s...")
                await asyncio.sleep(API_CALL_GAP)
            first_call = False

            try:
                extractor_input = build_extractor_input(profile["preferences"])
                dna = await extract_dna(extractor_input)
                await save_dna_to_local(db, pid, dna)
                print(f"  [dna] OK — themes: {dna.get('dominant_themes', [])[:3]}")
            except Exception as exc:
                print(f"  [dna] FAILED for {pid}: {exc}", file=sys.stderr)

        print("\n[seed] DNA extraction phase complete")

        # ── Phase 2: Ensure every profile has a users row for chat ──────────
        print("\n[seed] Syncing local profiles → users table for chat capability...")
        async with db.execute(
            "SELECT id, email, state, type, preferences, dna_profile FROM simulated_locals"
        ) as cursor:
            all_local_rows = [dict(r) for r in await cursor.fetchall()]

        for row in all_local_rows:
            dna = json.loads(row["dna_profile"]) if row["dna_profile"] else None
            profile_stub = {
                "id": row["id"],
                "email": row["email"],
                "state": row["state"],
                "preferences": json.loads(row["preferences"]),
            }
            user_id = await ensure_user_account(db, profile_stub, dna)
            # If DNA was extracted after user was created, sync it
            if dna:
                await sync_dna_to_user(db, user_id, dna)
            print(f"  [users] {row['id']} → users.id={user_id[:8]}...")

        print("[seed] users sync complete")

        # Reload all rows for ChromaDB
        async with db.execute(
            "SELECT id, state, dna_profile FROM simulated_locals"
        ) as cursor:
            all_rows = [{"id": r[0], "state": r[1], "dna_profile": r[2]}
                        async for r in cursor]

    # ── Phase 3: ChromaDB ────────────────────────────────────────────────────
    print(f"\n[chroma] Initializing ChromaDB at {CHROMA_PATH}")
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    existing_ids = set(collection.get(include=[])["ids"])
    print(f"[chroma] Collection '{COLLECTION_NAME}' has {len(existing_ids)} existing entries")

    added = 0
    skipped = 0
    for row in all_rows:
        pid = row["id"]
        if not row["dna_profile"]:
            print(f"  [chroma] {pid} has no DNA — skipping")
            skipped += 1
            continue

        if pid in existing_ids:
            print(f"  [chroma] {pid} already in collection — skipping")
            skipped += 1
            continue

        dna = json.loads(row["dna_profile"])
        embedding_text = dna_to_embedding_text(dna)
        if not embedding_text.strip():
            print(f"  [chroma] {pid} has empty embedding text — skipping")
            skipped += 1
            continue

        collection.add(
            ids=[pid],
            documents=[embedding_text],
            metadatas=[{"state": row["state"]}],
        )
        print(f"  [chroma] Added {pid}: '{embedding_text[:80]}...'")
        added += 1

    print(f"\n[seed] ChromaDB phase complete — added: {added}, skipped: {skipped}")
    print(f"[seed] Collection '{COLLECTION_NAME}' now has {collection.count()} entries")
    print("\n[seed] Done.")


if __name__ == "__main__":
    asyncio.run(main())
