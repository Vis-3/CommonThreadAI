import json
import os
import re
from collections import Counter

import chromadb

from db import get_local_user_ids, get_locals_by_ids
from llm_client import generate_json

_HERE = os.path.dirname(__file__)
_CHROMA_PATH = os.path.join(_HERE, "chroma_db")
_COLLECTION_NAME = "local_profiles"
_CONTENT_COLLECTION = "content_library"
_TOP_K = 3
_MAX_ITEMS = 5

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dna_to_query_text(dna: dict) -> str:
    """Same representation used during seeding — all 5 categories concatenated."""
    parts = (
        dna.get("dominant_themes", [])
        + dna.get("dominant_emotions", [])
        + dna.get("aesthetic_signatures", [])
        + dna.get("cultural_origins_detected", [])
        + dna.get("taste_palette", [])
    )
    return ", ".join(parts)


def _aggregate(profiles: list[dict], closest_id: str, category: str) -> list[str]:
    """
    Combine a preference category across profiles, deduplicated.
    Items appearing in more profiles rank first; ties broken by order in closest match.
    Returns at most _MAX_ITEMS items.
    """
    all_items: list[str] = []
    for p in profiles:
        all_items.extend(p["preferences"].get(category, []))

    counts = Counter(all_items)

    # Items from the closest match, in their original order
    closest_prefs = next(
        (p["preferences"].get(category, []) for p in profiles if p["id"] == closest_id),
        [],
    )

    seen: set[str] = set()
    ranked: list[str] = []

    # First pass: most-agreed-upon (count >= 2)
    for item, _ in counts.most_common():
        if counts[item] >= 2 and item not in seen:
            seen.add(item)
            ranked.append(item)
            if len(ranked) >= _MAX_ITEMS:
                return ranked

    # Fill from closest match
    for item in closest_prefs:
        if item not in seen:
            seen.add(item)
            ranked.append(item)
            if len(ranked) >= _MAX_ITEMS:
                return ranked

    # Fill any remaining from other profiles in order
    for item, _ in counts.most_common():
        if item not in seen:
            seen.add(item)
            ranked.append(item)
            if len(ranked) >= _MAX_ITEMS:
                return ranked

    return ranked


_PROMPT_TEMPLATE = """\
You are a cultural bridge guide helping an international student discover what \
locals with similar taste in their new home enjoy.

The international student's cultural DNA:
- Themes: {themes}
- Emotions: {emotions}
- Aesthetics: {aesthetics}

Based on taste similarity, here are recommendations across five categories:

Films: {films}
Music artists: {music}
Local food/scene: {local_scene}
Books: {books}
YouTube content: {youtube}

Write a "why it fits" explanation (1–2 sentences) for each category that \
connects the student's specific DNA to these recommendations.

Respond ONLY in valid JSON, no markdown fences, no preamble:
{{
  "film":        {{ "why": "...", "items": {films_json} }},
  "music":       {{ "why": "...", "items": {music_json} }},
  "local_scene": {{ "why": "...", "items": {local_scene_json} }},
  "book":        {{ "why": "...", "items": {books_json} }},
  "youtube":     {{ "why": "...", "items": {youtube_json} }}
}}
"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def _query_content_library(collection, query_text: str, content_type: str, n: int) -> list[str]:
    """Query content_library ChromaDB for real titles of a given type."""
    count = collection.count()
    if count == 0:
        return []
    try:
        results = collection.query(
            query_texts=[query_text],
            n_results=min(n, count),
            where={"type": content_type},
        )
        metas = results["metadatas"][0] if results["metadatas"] else []
        return [m["title"] for m in metas]
    except Exception:
        return []


async def get_bridge_recommendations(dna: dict, state: str) -> dict:
    """
    Given an international student's DNA and their US state, return personalised
    recommendations sourced from the content_library (no raw user data).
    Matched locals are resolved from local_profiles for the chat feature.
    """
    query_text = _dna_to_query_text(dna)
    if not query_text.strip():
        return {"film": {"why": "", "items": []},
                "music": {"why": "", "items": []},
                "local_scene": {"why": "", "items": []}}

    chroma_client = chromadb.PersistentClient(path=_CHROMA_PATH)

    # ------------------------------------------------------------------
    # 1. Query content_library for real grounded titles (no hallucination)
    # ------------------------------------------------------------------
    content_col = chroma_client.get_or_create_collection(
        name=_CONTENT_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    films       = _query_content_library(content_col, query_text, "film",        _MAX_ITEMS)
    music       = _query_content_library(content_col, query_text, "music",       _MAX_ITEMS)
    local_scene = _query_content_library(content_col, query_text, "local_scene", _MAX_ITEMS)
    books       = _query_content_library(content_col, query_text, "book",        _MAX_ITEMS)
    youtube     = _query_content_library(content_col, query_text, "youtube",     _MAX_ITEMS)

    # ------------------------------------------------------------------
    # 2. Query local_profiles for matched users → chat feature
    # ------------------------------------------------------------------
    profiles_col = chroma_client.get_or_create_collection(
        name=_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    where_filter = {"state": state} if state else None
    query_kwargs: dict = {
        "query_texts": [query_text],
        "n_results": min(_TOP_K, profiles_col.count()),
    }
    if where_filter:
        query_kwargs["where"] = where_filter

    matched_locals: list[dict] = []
    try:
        results = profiles_col.query(**query_kwargs)
        matched_ids: list[str] = results["ids"][0] if results["ids"] else []
        if matched_ids:
            matched_locals = await get_local_user_ids(matched_ids)
    except Exception:
        pass

    # ------------------------------------------------------------------
    # 3. Ask Claude to write "why it fits" — titles are already grounded
    # ------------------------------------------------------------------
    def _items_only() -> dict:
        return {
            "film":           {"why": "", "items": films},
            "music":          {"why": "", "items": music},
            "local_scene":    {"why": "", "items": local_scene},
            "book":           {"why": "", "items": books},
            "youtube":        {"why": "", "items": youtube},
            "matched_locals": matched_locals,
        }

    if not any([films, music, local_scene, books, youtube]):
        return _items_only()

    prompt = _PROMPT_TEMPLATE.format(
        themes=json.dumps(dna.get("dominant_themes", [])),
        emotions=json.dumps(dna.get("dominant_emotions", [])),
        aesthetics=json.dumps(dna.get("aesthetic_signatures", [])),
        films=", ".join(films),
        music=", ".join(music),
        local_scene=", ".join(local_scene),
        books=", ".join(books),
        youtube=", ".join(youtube),
        films_json=json.dumps(films),
        music_json=json.dumps(music),
        local_scene_json=json.dumps(local_scene),
        books_json=json.dumps(books),
        youtube_json=json.dumps(youtube),
    )

    try:
        raw = await generate_json(
            prompt,
            system="You are a cultural bridge guide. Respond with valid JSON only — no markdown fences, no explanation, no preamble.",
            max_tokens=1024,
        )
        result = json.loads(raw)
        result["matched_locals"] = matched_locals
        # Ensure all keys present even if Claude omitted one
        for key, fallback in [("book", books), ("youtube", youtube)]:
            if key not in result:
                result[key] = {"why": "", "items": fallback}
        return result
    except Exception:
        return _items_only()
