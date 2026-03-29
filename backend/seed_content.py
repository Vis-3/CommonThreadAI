"""
One-time script: reads content_library.json and populates:
  1. SQLite  → content_items table
  2. ChromaDB → content_library collection

Run from backend/:
  python seed_content.py
"""

import asyncio
import json
import os
import uuid

import aiosqlite
import chromadb

_HERE = os.path.dirname(__file__)
_DB_PATH = os.path.join(_HERE, "commonthread.db")
_CHROMA_PATH = os.path.join(_HERE, "chroma_db")
_LIBRARY_FILE = os.path.join(_HERE, "content_library.json")
_COLLECTION_NAME = "content_library"

_CREATE_CONTENT_ITEMS = """
CREATE TABLE IF NOT EXISTS content_items (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('film','music','local_scene','book','youtube')),
    tags        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"""

# ── Helpers ────────────────────────────────────────────────────────────────────

def _tags_to_text(tags: list[str]) -> str:
    return ", ".join(tags)


async def _seed_sqlite(items: list[dict]) -> dict[str, str]:
    """Insert items into content_items. Returns {title+type → id} map."""
    id_map: dict[str, str] = {}
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(_CREATE_CONTENT_ITEMS)
        await db.commit()

        for item in items:
            key = f"{item['title']}::{item['type']}"
            # Check for duplicate
            async with db.execute(
                "SELECT id FROM content_items WHERE title = ? AND type = ?",
                (item["title"], item["type"]),
            ) as cur:
                row = await cur.fetchone()
            if row:
                id_map[key] = row[0]
                print(f"  [skip] {item['type']:12} {item['title']}")
                continue

            item_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO content_items (id, title, type, tags, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                (item_id, item["title"], item["type"], json.dumps(item["tags"])),
            )
            id_map[key] = item_id
            print(f"  [add]  {item['type']:12} {item['title']}")

        await db.commit()
    return id_map


def _seed_chroma(items: list[dict], id_map: dict[str, str]) -> None:
    """Upsert items into the content_library ChromaDB collection."""
    client = chromadb.PersistentClient(path=_CHROMA_PATH)
    collection = client.get_or_create_collection(
        name=_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Build batch
    ids, documents, metadatas = [], [], []
    for item in items:
        key = f"{item['title']}::{item['type']}"
        item_id = id_map.get(key)
        if not item_id:
            continue
        ids.append(item_id)
        documents.append(_tags_to_text(item["tags"]))
        metadatas.append({"title": item["title"], "type": item["type"]})

    if ids:
        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        print(f"\nChromaDB: upserted {len(ids)} items into '{_COLLECTION_NAME}'")


# ── Main ───────────────────────────────────────────────────────────────────────

async def main() -> None:
    print(f"Loading {_LIBRARY_FILE} ...")
    with open(_LIBRARY_FILE, encoding="utf-8") as f:
        items = json.load(f)

    # Deduplicate by title+type (JSON may have accidental duplicates)
    seen: set[str] = set()
    unique: list[dict] = []
    for item in items:
        key = f"{item['title']}::{item['type']}"
        if key not in seen:
            seen.add(key)
            unique.append(item)

    print(f"Found {len(unique)} unique items ({len(items) - len(unique)} duplicates skipped)\n")
    print("── SQLite ─────────────────────────────────────────────────")
    id_map = await _seed_sqlite(unique)

    print("\n── ChromaDB ───────────────────────────────────────────────")
    _seed_chroma(unique, id_map)

    counts: dict[str, int] = {}
    for item in unique:
        counts[item["type"]] = counts.get(item["type"], 0) + 1
    print("\n── Summary ────────────────────────────────────────────────")
    for t, c in sorted(counts.items()):
        print(f"  {t:15} {c} items")
    print(f"\nDone. Total: {len(unique)} items seeded.")


if __name__ == "__main__":
    asyncio.run(main())
