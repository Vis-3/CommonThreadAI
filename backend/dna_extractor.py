import json
import os
import re

from llm_client import generate_json

_ITEM_RE = re.compile(r"^[a-zA-Z0-9 .,'\-\(\)&:!?]{1,300}$")
_MAX_ITEMS = 200
_MAX_ITEM_LEN = 300


def _sanitize_list(items: list) -> list[str]:
    """Filter a list of items, silently dropping invalid ones."""
    out = []
    for item in items[:_MAX_ITEMS]:
        if not isinstance(item, str):
            continue
        item = item.strip()
        if item and len(item) <= _MAX_ITEM_LEN and _ITEM_RE.match(item):
            out.append(item)
    return out


_PROMPT_TEMPLATE = """\
You are a cultural analyst. Analyse the following media consumption data and extract a "cultural DNA" profile.

YouTube video titles: {youtube_titles}
Movies & shows: {movies}
Music tracks / albums / artists: {music}
Books: {books}
Food preferences & places: {food}

Return ONLY a valid JSON object — no markdown fences, no preamble, no trailing text — with exactly these keys:

{{
  "dominant_themes": ["5 to 8 abstract themes, NOT genres"],
  "dominant_emotions": ["4 to 6 emotional registers"],
  "aesthetic_signatures": ["4 to 6 aesthetic patterns"],
  "cultural_origins_detected": ["best-guess list of cultural backgrounds represented"],
  "taste_palette": ["4 to 6 sensory or taste preferences"],
  "confidence_notes": "one sentence about confidence level"
}}

Example output (do not copy these values, analyse the actual data above):
{{
  "dominant_themes": ["longing for home", "found family", "quiet rebellion"],
  "dominant_emotions": ["melancholic warmth", "joyful defiance"],
  "aesthetic_signatures": ["muted earth tones", "lo-fi intimacy"],
  "cultural_origins_detected": ["South Asian diaspora", "East Asian pop culture"],
  "taste_palette": ["bold spicy flavors", "earthy umami"],
  "confidence_notes": "High confidence based on diverse media inputs."
}}

STRICT FORMATTING RULES for every string value:
- Maximum 5 words per tag. Be concise.
- Use only plain letters, numbers, spaces, and hyphens. No parentheses, no slashes, no special characters.
- Wrong: "South Asian diaspora (specifically Indian-American/Indian-British)"
- Right: "South Asian diaspora"
"""


async def extract_dna(inputs: dict) -> dict:
    """
    Extract a cultural DNA profile from user media inputs.

    inputs keys: youtube_titles, books, music (each a list of strings).
    Returns the parsed DNA dict.
    Raises ValueError if all inputs are filtered out.
    """
    youtube = _sanitize_list(inputs.get("youtube_titles") or [])
    movies = _sanitize_list(inputs.get("movies") or [])
    music = _sanitize_list(inputs.get("music") or [])
    books = _sanitize_list(inputs.get("books") or [])
    food = _sanitize_list(inputs.get("food") or [])

    if not youtube and not movies and not music and not books and not food:
        raise ValueError(
            "No valid media items were provided. Please include at least one category "
            "using standard characters."
        )

    prompt = _PROMPT_TEMPLATE.format(
        youtube_titles=json.dumps(youtube) if youtube else "[]",
        movies=json.dumps(movies) if movies else "[]",
        music=json.dumps(music) if music else "[]",
        books=json.dumps(books) if books else "[]",
        food=json.dumps(food) if food else "[]",
    )

    raw = await generate_json(
        prompt,
        system="You are a cultural analyst. Respond with valid JSON only — no markdown fences, no explanation, no preamble.",
        max_tokens=1024,
    )
    return json.loads(raw)
