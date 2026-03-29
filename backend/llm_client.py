"""
llm_client.py — Shared async Claude wrapper.

Set ANTHROPIC_API_KEY in your .env file.
Optionally set ANTHROPIC_MODEL to override the default.

Default model: claude-haiku-4-5-20251001  (fast + cheap, great at JSON)
Better quality: claude-sonnet-4-6          (slower, higher cost)
"""

import os
import re

import anthropic
from dotenv import load_dotenv

load_dotenv()

_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

_FENCE_RE = re.compile(r"^```[a-zA-Z]*\n?|\n?```$", re.MULTILINE)


def _extract_json(text: str) -> str:
    """Strip markdown fences, then isolate the first complete JSON object or array."""
    text = _FENCE_RE.sub("", text).strip()

    if text and text[0] in ("{", "["):
        return text

    for start_ch, end_ch in (("{", "}"), ("[", "]")):
        start = text.find(start_ch)
        if start == -1:
            continue
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == start_ch:
                depth += 1
            elif ch == end_ch:
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]

    return text


async def generate_json(
    prompt: str,
    *,
    system: str = "You are a helpful assistant. Respond with valid JSON only — no markdown fences, no explanation, no preamble.",
    max_tokens: int = 2048,
) -> str:
    """
    Call Claude and return the response with fences stripped and JSON extracted.
    Raises anthropic.APIError on API failures (let callers handle or fall back).
    """
    message = await _client.messages.create(
        model=_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    return _extract_json(raw)
