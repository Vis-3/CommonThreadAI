# CommonThread — Project Overview

**Tagline:** *Your culture is the bridge.*

CommonThread is a web application for international university students. It uses AI to extract a "cultural DNA" profile from a student's media habits, then uses that profile to bridge them into their new home's culture and connect them with peers who share their taste.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Zustand |
| Backend | FastAPI (Python), aiosqlite (SQLite), ChromaDB |
| AI | Google Gemini 2.5 Flash |
| Auth | JWT (HS256, 7-day expiry), bcrypt + SHA-256 |
| Realtime | WebSockets (FastAPI native) |

---

## User Flow — Step by Step

### Step 1 — Sign Up / Login

Users register with:
- **Institutional email only** — `.edu`, `.ac.uk`, `.ac.in`, `.edu.sg`, etc. (personal emails rejected)
- Username (3–30 chars, letters/numbers/underscores)
- Display name (2–50 chars)
- Password (8–128 chars, must contain a letter and a digit)
- US state (dropdown, all 50 states validated server-side)

University is auto-derived from the email domain (e.g. `user@iu.edu` → university = `iu.edu`).

Successful auth returns a JWT token stored in the Zustand store.

---

### Step 2 — Cultural Input

A horizontally-swipeable carousel with **5 media categories**:

| Category | Accepted Input |
|---|---|
| YouTube | Drag-drop watch history JSON (Google Takeout) or typed titles |
| Movies & Shows | Drag-drop Netflix CSV or typed titles |
| Music | Drag-drop Spotify JSON or Last.fm CSV, or typed artists/tracks |
| Books | Drag-drop Goodreads CSV or typed titles |
| Food & Places | Typed cuisines, restaurants, food preferences |

- Files are parsed client-side; individual items validated by regex before submission
- Max 200 items per category; max 300 chars per item
- Minimum 5 total items required to submit
- Categories are skippable
- All 5 are sent to `POST /api/extract-dna`
- DNA extraction is **rate-limited to 3 calls per day per user**

---

### Step 3 — Verify DNA

Gemini 2.5 Flash analyses the submitted media and returns a **Cultural DNA profile** with 5 dimensions:

| Dimension | Example values |
|---|---|
| **Dominant Themes** | "longing for home", "found family", "quiet rebellion" |
| **Dominant Emotions** | "melancholic warmth", "existential dread", "joyful defiance" |
| **Aesthetic Signatures** | "muted earth tones", "lo-fi intimacy", "maximalist layering" |
| **Cultural Origins Detected** | "South Asian diaspora", "East Asian pop culture" |
| **Taste Palette** | "bold spicy flavors", "earthy umami", "rich layered textures" |

The user reviews the AI output and can:
- Add tags (validated: 2–100 chars, max 10 per category)
- Remove tags
- Edit freely before saving

Includes an AI confidence note shown at the top of the review screen.

Once satisfied, the user clicks **"This looks right — Save My DNA"** which calls `POST /api/verify-dna`. The profile is saved to the database and versioned in a `dna_profiles` audit table.

---

### Step 4 — DNA Mind Map

An interactive **SVG visualization** of the DNA profile:

- Central **"You"** node
- **5 organic cluster bubbles** (one per DNA dimension), with irregular blob shapes generated via Catmull-Rom curves and a seeded PRNG for deterministic layout
- Nodes placed inside bubbles using a golden-angle spiral
- A **repulsion algorithm** (120 iterations) prevents clusters from overlapping
- **Edges** drawn from the center to each cluster
- Hover any node for full label + subtle glow
- **Pan** (click-drag), **Zoom** (+ / − buttons)
- **Fullscreen mode** via the browser Fullscreen API
- Background image with dark veil overlay

After reviewing the map, the user clicks **Continue** to proceed.

---

### Step 5 — Choose a Path

Two distinct directions:

#### Path A — "Bridge your culture to [State]"
*Find films, music, and local places from your state's scene that connect to what you already love.*

#### Path B — "Find others on the same journey"
*Match with other students whose taste points toward the same blind spots as yours.*

---

### Step 6A — Local Bridge (Path A)

**How it works:**
1. The user's DNA is converted to an embedding text (all 5 dimensions concatenated)
2. ChromaDB finds the **top 3 most similar local Indiana profiles** (filtered by `state`) using cosine similarity
3. The raw preferences of those 3 profiles (films, music, local food) are fetched from SQLite
4. Items are aggregated: consensus items (appearing in 2+ profiles) rank first, then filled from the closest match, capped at 5 per category
5. Gemini writes a "why it fits" explanation for each category, connecting the user's specific DNA to those recommendations
6. If Gemini quota is hit, the items are still shown without explanations (graceful fallback)

**Results page shows:**

| Section | Content |
|---|---|
| 🎬 Film & TV | Up to 5 films/shows popular with matched locals |
| 🎵 Music | Up to 5 artists popular with matched locals |
| 🍽 Local Scene | Up to 5 food/places popular with matched locals |
| 👥 Local Connections | The 3 matched local students, each with a **Connect** button |

The Connect button opens a chat with that student directly.

---

### Step 6B — Connect Path (Path B)

Two things load in parallel:

**Blind Spots** — 3 works from cultures *different* from the user's detected origins that thematically match their DNA:
- Each card shows: title, creator, type badge, culture-of-origin badge
- "Blind spot reason" — why this is a gap given their background
- "Discovery hook" — a specific detail tying it to their DNA

**Student Matches** — Up to 3 real verified users whose DNA themes most overlap:
- Match score shown as a gradient progress bar (Jaccard overlap %)
- Shared blind spots listed (themes present in both users but outside either's cultural origins)
- **Compare notes** button opens a real-time chat
- If fewer than 3 real users exist, padded with simulated "Traveller" profiles (chat disabled, clearly labelled)

---

### Step 7 — Chat

Clicking Connect or Compare notes:
1. Calls `POST /api/conversations` to get or create a conversation between the two user IDs
2. Opens a **WebSocket** to `/ws/chat/{conversation_id}?token=...`
3. Messages are saved to the database and broadcast to all participants in the room
4. Last 50 messages are loaded on open

The chat window is an overlay — the user can close it and return to results without losing state.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | — | Register with institutional email |
| POST | `/api/login` | — | Login, returns JWT |
| GET | `/api/me` | ✓ | Get current user |
| POST | `/api/extract-dna` | ✓ | Extract DNA from media input (3/day limit) |
| POST | `/api/verify-dna` | ✓ | Save verified DNA profile |
| PATCH | `/api/users/me/dna` | ✓ | Update DNA profile |
| POST | `/api/bridge` | ✓ | Get local recommendations + matched locals |
| POST | `/api/blindspots` | ✓ | Get 3 cross-cultural blind spot works |
| POST | `/api/match` | ✓ | Get top 3 matched students |
| POST | `/api/conversations` | ✓ | Get or create conversation |
| GET | `/api/conversations/{id}/messages` | ✓ | Fetch last 50 messages |
| WS | `/ws/chat/{id}?token=` | ✓ | Real-time chat |
| GET | `/api/health` | — | Health check |

---

## Database Schema

```
users
  id, username (unique), display_name, email (unique),
  hashed_password, state, university, dna_profile (JSON),
  dna_verified (0/1), created_at

dna_profiles          ← versioned audit trail
  id, user_id, profile (JSON), source ('extracted'|'verified_edit'), created_at

conversations
  id, user_a_id, user_b_id, created_at

messages
  id, conversation_id, sender_id, content, created_at

simulated_locals      ← Indiana local profiles for bridge matching
  id, email, state, type, preferences (JSON),
  dna_profile (JSON), user_id (FK → users.id)
```

---

## Local Profiles Setup (seed_locals.py)

The bridge feature depends on pre-seeded Indiana local profiles:

```bash
cd backend && python seed_locals.py
```

**What it does:**
1. Reads `local_profiles_indiana.json` (38 Indiana student profiles)
2. Inserts into `simulated_locals` table
3. Calls `extract_dna()` for each profile (4s gap between calls to respect Gemini rate limits)
4. Inserts each profile into the `users` table (so the chat system can reach them)
5. Stores the `user_id` back in `simulated_locals` for the bridge_mapper join
6. Embeds each DNA into ChromaDB collection `"local_profiles"` (cosine similarity)

Safe to re-run — skips profiles that already have DNA or are already in ChromaDB.

---

## Security Notes

- Passwords: SHA-256 pre-hash → bcrypt (handles passwords > 72 bytes safely)
- JWT secret read from `JWT_SECRET` env var (defaults to `"changeme"` — **change in production**)
- Gemini key read from `GEMINI_API_KEY` env var
- All protected endpoints require `Authorization: Bearer <token>`
- `hashed_password` is stripped from every API response
- Local profile IDs and emails are never returned to the frontend; only opaque UUIDs are exposed
- CORS restricted to `http://localhost:5173`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `JWT_SECRET` | Yes (prod) | Secret for signing JWTs |

---

## Known Limitations

- **Rate limit**: Gemini free tier is 20 RPM. If exceeded during bridge recommendations, "why" explanations are omitted but items still display.
- **Matching**: With few registered users, the "Connect" path pads with simulated profiles. Chat is disabled for simulated matches.
- **State filtering**: Bridge matching currently seeds Indiana profiles only. Adding more states requires additional `local_profiles_<state>.json` files and re-seeding.
- **In-memory rate limit**: The 3/day DNA extraction limit resets on server restart.
- **CORS**: Hardcoded to `localhost:5173` — update `allow_origins` in `main.py` for deployment.
