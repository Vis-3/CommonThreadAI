import json
import os

from llm_client import generate_json

_BASE_DIR = os.path.dirname(__file__)


def _load_json(filename: str) -> list:
    path = os.path.join(_BASE_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_PROMPT_TEMPLATE = """\
You are a cultural discovery guide.

The user's cultural DNA:
- Dominant themes: {themes}
- Dominant emotions: {emotions}
- Aesthetic signatures: {aesthetics}
- Detected cultural origins: {origins}

Cultural dataset:
{cultural_dataset}

Task:
Find exactly 3 works from the dataset that come from cultures DIFFERENT from the user's detected origins,
but share deep thematic or emotional overlap with the user's DNA.
These are "blind spots" — culturally resonant works the user has likely never encountered.

Return ONLY a valid JSON array — no markdown fences, no preamble — in this format:

[
  {{
    "title": "...",
    "creator": "...",
    "type": "...",
    "culture_of_origin": "...",
    "blind_spot_reason": "1–2 sentences explaining why this is a blind spot and what it shares with the user's DNA",
    "discovery_hook": "one vivid, specific detail from this work that connects to something in the user's DNA"
  }}
]
"""


async def surface_blind_spots(dna: dict) -> list[dict]:
    """
    Return 3 works from cultures different from the user's origins
    that share deep thematic overlap with their DNA.
    """
    cultural_dataset = _load_json("cultural_dataset.json")

    prompt = _PROMPT_TEMPLATE.format(
        themes=json.dumps(dna.get("dominant_themes", [])),
        emotions=json.dumps(dna.get("dominant_emotions", [])),
        aesthetics=json.dumps(dna.get("aesthetic_signatures", [])),
        origins=json.dumps(dna.get("cultural_origins_detected", [])),
        cultural_dataset=json.dumps(cultural_dataset, ensure_ascii=False),
    )

    raw = await generate_json(
        prompt,
        system="You are a cultural discovery guide. Respond with a valid JSON array only — no markdown fences, no explanation, no preamble.",
        max_tokens=1024,
    )
    return json.loads(raw)
