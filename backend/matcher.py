import json
import os
import uuid

import aiosqlite

_BASE_DIR = os.path.dirname(__file__)


def _overlap_score(themes_a: list[str], themes_b: list[str]) -> float:
    """Jaccard-style overlap: shared / total unique * 100."""
    set_a = set(t.lower() for t in themes_a)
    set_b = set(t.lower() for t in themes_b)
    if not set_a and not set_b:
        return 0.0
    shared = len(set_a & set_b)
    total = len(set_a | set_b)
    return round(shared / total * 100, 1) if total > 0 else 0.0


def _shared_blind_spots(dna_a: dict, dna_b: dict) -> list[str]:
    """
    Themes present in both users' dominant_themes but NOT in either's
    cultural_origins_detected (proxy for 'blind spots').
    """
    themes_a = set(t.lower() for t in (dna_a.get("dominant_themes") or []))
    themes_b = set(t.lower() for t in (dna_b.get("dominant_themes") or []))
    origins_a = set(o.lower() for o in (dna_a.get("cultural_origins_detected") or []))
    origins_b = set(o.lower() for o in (dna_b.get("cultural_origins_detected") or []))

    shared = themes_a & themes_b
    all_origins = origins_a | origins_b

    # Keep only themes that do not appear as a substring of any known origin
    blind = [
        t for t in shared
        if not any(o in t or t in o for o in all_origins)
    ]
    return blind


def _make_simulated_profile(index: int, current_dna: dict) -> dict:
    """Generate a plausible simulated user whose themes overlap with current user."""
    themes = (current_dna.get("dominant_themes") or [])[:3]
    emotions = (current_dna.get("dominant_emotions") or [])[:2]

    sim_id = f"sim-{uuid.uuid4()}"
    sim_dna = {
        "dominant_themes": themes + [f"simulated_theme_{index}"],
        "dominant_emotions": emotions,
        "aesthetic_signatures": current_dna.get("aesthetic_signatures", [])[:2],
        "cultural_origins_detected": [f"Simulated Culture {index}"],
    }
    score = _overlap_score(
        current_dna.get("dominant_themes", []),
        sim_dna["dominant_themes"],
    )
    return {
        "user_id": sim_id,
        "display_name": f"Traveller {index + 1}",
        "university": "simulated.edu",
        "state": "California",
        "overlap_score": score,
        "shared_blind_spots": _shared_blind_spots(current_dna, sim_dna),
        "simulated": True,
    }


async def find_matches(
    current_user_id: str,
    dna: dict,
    db_path: str = "commonthread.db",
) -> list[dict]:
    """
    Find up to 3 real verified users whose dominant_themes overlap with `dna`.
    Pad with simulated profiles if fewer than 3 real matches exist.
    """
    resolved_path = db_path if os.path.isabs(db_path) else os.path.join(_BASE_DIR, db_path)

    candidates = []
    async with aiosqlite.connect(resolved_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT id, display_name, university, state, dna_profile
            FROM users
            WHERE dna_verified = 1 AND id != ?
            """,
            (current_user_id,),
        )
        rows = await cursor.fetchall()

    current_themes = dna.get("dominant_themes") or []

    for row in rows:
        try:
            candidate_dna = json.loads(row["dna_profile"]) if row["dna_profile"] else {}
        except (json.JSONDecodeError, TypeError):
            candidate_dna = {}

        candidate_themes = candidate_dna.get("dominant_themes") or []
        score = _overlap_score(current_themes, candidate_themes)
        candidates.append(
            {
                "user_id": row["id"],
                "display_name": row["display_name"],
                "university": row["university"],
                "state": row["state"],
                "overlap_score": score,
                "_dna": candidate_dna,
                "simulated": False,
            }
        )

    # Sort by score descending, take top 3
    candidates.sort(key=lambda c: c["overlap_score"], reverse=True)
    top3 = candidates[:3]

    # Enrich with shared blind spots and strip internal _dna key
    results = []
    for c in top3:
        c["shared_blind_spots"] = _shared_blind_spots(dna, c.pop("_dna"))
        results.append(c)

    # Pad with simulated profiles if needed
    needed = 3 - len(results)
    for i in range(needed):
        results.append(_make_simulated_profile(i, dna))

    return results
