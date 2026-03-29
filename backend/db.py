import json
import os
import uuid
from datetime import datetime, timezone

import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "commonthread.db")

_CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    state           TEXT NOT NULL,
    university      TEXT NOT NULL,
    dna_profile     TEXT,
    dna_verified    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);
"""

_CREATE_CONVERSATIONS = """
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    user_a_id   TEXT NOT NULL,
    user_b_id   TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_a_id) REFERENCES users(id),
    FOREIGN KEY (user_b_id) REFERENCES users(id)
);
"""

_CREATE_MESSAGES = """
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id       TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);
"""

_CREATE_DNA_PROFILES = """
CREATE TABLE IF NOT EXISTS dna_profiles (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    profile     TEXT NOT NULL,
    source      TEXT NOT NULL CHECK(source IN ('extracted', 'verified_edit')),
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_university(email: str) -> str:
    """Best-effort: strip the local part and 'www.' to get a domain label."""
    domain = email.split("@", 1)[-1].lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _row_to_dict(row: aiosqlite.Row) -> dict:
    return dict(row)


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(_CREATE_USERS)
        await db.execute(_CREATE_CONVERSATIONS)
        await db.execute(_CREATE_MESSAGES)
        await db.execute(_CREATE_DNA_PROFILES)
        await db.commit()


async def create_user(
    username: str,
    display_name: str,
    email: str,
    hashed_password: str,
    state: str,
) -> dict:
    user_id = str(uuid.uuid4())
    university = _parse_university(email)
    created_at = _now()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO users
                (id, username, display_name, email, hashed_password,
                 state, university, dna_profile, dna_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)
            """,
            (user_id, username, display_name, email, hashed_password,
             state, university, created_at),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        return _row_to_dict(row)


async def get_user_by_username(username: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None


async def get_user_by_id(user_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None


async def save_dna_profile(user_id: str, profile: dict, source: str) -> dict:
    """
    Persist a versioned DNA snapshot and update the live dna_profile on users.
    Returns the updated user row.
    """
    profile_id = str(uuid.uuid4())
    profile_json = json.dumps(profile)
    created_at = _now()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Insert versioned history
        await db.execute(
            """
            INSERT INTO dna_profiles (id, user_id, profile, source, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (profile_id, user_id, profile_json, source, created_at),
        )

        # Update live profile on the user row; mark as verified
        await db.execute(
            """
            UPDATE users
            SET dna_profile = ?, dna_verified = 1
            WHERE id = ?
            """,
            (profile_json, user_id),
        )

        await db.commit()

        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        return _row_to_dict(row)


async def get_or_create_conversation(user_a_id: str, user_b_id: str) -> dict:
    """
    Return an existing conversation between the two users, or create one.
    Normalise order so (A,B) == (B,A).
    """
    # Canonical ordering
    lo, hi = sorted([user_a_id, user_b_id])

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute(
            """
            SELECT * FROM conversations
            WHERE (user_a_id = ? AND user_b_id = ?)
               OR (user_a_id = ? AND user_b_id = ?)
            LIMIT 1
            """,
            (lo, hi, hi, lo),
        )
        row = await cursor.fetchone()
        if row:
            return _row_to_dict(row)

        conv_id = str(uuid.uuid4())
        created_at = _now()
        await db.execute(
            "INSERT INTO conversations (id, user_a_id, user_b_id, created_at) VALUES (?, ?, ?, ?)",
            (conv_id, lo, hi, created_at),
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row)


async def save_message(
    conversation_id: str, sender_id: str, content: str
) -> dict:
    msg_id = str(uuid.uuid4())
    created_at = _now()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conversation_id, sender_id, content, created_at),
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM messages WHERE id = ?", (msg_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row)


async def get_messages(conversation_id: str, limit: int = 50) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT * FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (conversation_id, limit),
        )
        rows = await cursor.fetchall()
        # Return in chronological order
        return [_row_to_dict(r) for r in reversed(rows)]


async def get_local_user_ids(local_ids: list[str]) -> list[dict]:
    """
    Given simulated_locals IDs (from ChromaDB), return their corresponding
    users table rows: [{user_id, display_name, state}] — no PII.
    """
    if not local_ids:
        return []
    placeholders = ",".join("?" * len(local_ids))
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            f"""
            SELECT u.id as user_id, u.display_name, u.state
            FROM simulated_locals sl
            JOIN users u ON u.id = sl.user_id
            WHERE sl.id IN ({placeholders}) AND sl.user_id IS NOT NULL
            """,
            local_ids,
        )
        rows = await cursor.fetchall()
    # Preserve the order of local_ids (closest match first)
    order = {lid: i for i, lid in enumerate(local_ids)}
    result = [dict(r) for r in rows]
    return result


async def get_locals_by_ids(ids: list[str]) -> list[dict]:
    """Fetch simulated_locals rows for the given IDs. Returns only id, state, preferences."""
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            f"SELECT id, state, preferences FROM simulated_locals WHERE id IN ({placeholders})",
            ids,
        )
        rows = await cursor.fetchall()
    result = []
    for row in rows:
        r = dict(row)
        r["preferences"] = json.loads(r["preferences"])
        result.append(r)
    return result


async def get_conversations_for_user(user_id: str) -> list[dict]:
    """
    Return all conversations for a user, enriched with the other party's
    display_name and the last message content + timestamp.
    Ordered by most recent activity first.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute(
            """
            SELECT
                c.id            AS conversation_id,
                c.user_a_id,
                c.user_b_id,
                c.created_at    AS conversation_created_at,
                u.id            AS other_user_id,
                u.display_name  AS other_display_name,
                m.content       AS last_message,
                m.sender_id     AS last_sender_id,
                m.created_at    AS last_message_at
            FROM conversations c
            JOIN users u ON u.id = CASE
                WHEN c.user_a_id = ? THEN c.user_b_id
                ELSE c.user_a_id
            END
            LEFT JOIN messages m ON m.id = (
                SELECT id FROM messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
            )
            WHERE c.user_a_id = ? OR c.user_b_id = ?
            ORDER BY COALESCE(m.created_at, c.created_at) DESC
            """,
            (user_id, user_id, user_id),
        )
        rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_all_verified_users_except(user_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT * FROM users
            WHERE dna_verified = 1 AND id != ?
            """,
            (user_id,),
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]
