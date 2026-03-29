# CommonThread — Project Overview

## What It Does

CommonThread helps international students arriving in the United States feel culturally at home faster. A student enters their media diet — YouTube channels, movies, music, books, and food — and the system extracts an abstract "Cultural DNA" profile representing their themes, emotions, aesthetics, origins, and taste. That DNA is then used to:

1. **Visualise identity** — an interactive mind-map shows the five DNA dimensions as interconnected honeycomb clusters
2. **Bridge to local culture** — surface films, music, books, local restaurants, and YouTube content already loved by US students with matching taste
3. **Surface blind spots** — recommend culturally different works that share deep thematic resonance with the student's DNA
4. **Connect with peers** — match the student with US-based students who share similar cultural DNA, and open a real-time chat with them directly from the results screen

---

## User Flow

```
Register (institutional email required)
    ↓
Cultural Input (YouTube, movies, music, books, food)
    ↓
DNA Extraction — Claude Haiku analyses inputs → 5-dimension profile
    ↓
DNA Verification — user reviews/edits before confirming
    ↓
Mind Map — interactive SVG visualisation of their DNA
    ↓
Path Chooser (Bridge / Blind Spots / Match)
    ↓
Bridge Results — 5-category local recommendations + matched local users → chat
```

---

## Tech Stack

### Backend — Python / FastAPI

| Component | Technology | Role |
|---|---|---|
| API server | FastAPI + Uvicorn | REST endpoints, WebSocket chat |
| Database | SQLite + aiosqlite | Users, conversations, messages, DNA profiles |
| Vector store | ChromaDB (persistent) | Two collections: `local_profiles` + `content_library` |
| LLM | Anthropic Claude Haiku 4.5 | DNA extraction, "why it fits" explanations, blind spot curation |
| Auth | JWT (HS256) + bcrypt | Token-based auth, hashed passwords |
| Input safety | Regex validation + rate limiting | Tag sanitisation, 3 DNA extractions/day per user |

**Key backend modules:**

- `dna_extractor.py` — prompts Claude with the user's raw media list; returns a structured 5-dimension DNA object
- `bridge_mapper.py` — queries `content_library` ChromaDB collection for grounded film/music/book/local/YouTube titles; passes titles to Claude only to write explanations (Claude never invents titles)
- `blind_spot.py` — uses a curated `cultural_dataset.json` to find works from different cultures that share the user's emotional/thematic DNA
- `matcher.py` — vector similarity search in `local_profiles` ChromaDB collection
- `chat.py` — WebSocket connection manager; broadcasts messages to all participants in a conversation room
- `seed_content.py` — one-time seeding script that populates `content_library` (SQLite + ChromaDB) from `content_library.json`
- `seed_locals.py` — seeds `local_profiles` ChromaDB collection from Indiana student profile data

### Frontend — React 19 / Vite

| Component | Technology |
|---|---|
| UI framework | React 19 + Vite |
| State management | Zustand (`useDNAStore`) |
| Styling | Tailwind CSS + inline styles |
| Real-time chat | Native WebSocket API |
| Visualisation | Hand-written SVG (no chart library) |

**Key frontend components:**

- `InputUploader.jsx` — collects raw media entries across 5 categories
- `DNAVerification.jsx` — shows extracted DNA for user review and editing before saving
- `MindMap.jsx` — interactive SVG mind map: YOU center → 5 category hub circles → honeycomb hexagon clusters (one per DNA tag); supports drag/pan/zoom/fullscreen
- `BridgeResults.jsx` — renders 5 recommendation sections (film, music, local scene, books, YouTube) + matched local user cards with direct chat
- `ChatWindow.jsx` — real-time WebSocket chat window with conversation history
- `BlindSpots.jsx` — displays 3 culturally distant but thematically resonant recommendations
- `Inbox.jsx` — lists all active conversations

---

## Data Architecture

### Two-Collection ChromaDB Design

The system uses two completely separate ChromaDB collections to enforce a strict privacy boundary:

**`content_library`** (anonymous, tagged cultural content)
- 338 items across 5 types: film, music, local_scene, book, youtube
- Each item: `{title, type, tags[]}` — tags extracted from knowledge, no user data
- Used exclusively for recommendations — Claude never touches this data to invent titles, only to write "why it fits" explanations
- Source: anonymised and tagged from Indiana student profile data by hand

**`local_profiles`** (for peer matching and chat only)
- Seeded from `local_profiles_indiana.json`
- Used only to find user IDs for the chat feature
- Raw preference lists from this collection are never surfaced in recommendations

### SQLite Schema

```
users            — id, username, display_name, email, hashed_password, state, dna_profile, dna_verified
dna_profiles     — id, user_id, profile (JSON), source ('extracted'|'verified_edit'), created_at
conversations    — id, user_a_id, user_b_id, created_at
messages         — id, conversation_id, sender_id, content, created_at
content_items    — id, title, type, tags (JSON), created_at
```

---

## Ethical Considerations & How They Are Addressed in Code

### 1. Raw Data Is Never Stored
**Risk:** Storing a user's raw YouTube watch history, movie list, etc. exposes sensitive behavioural data.

**Resolution:** Raw inputs are passed to Claude for extraction and then discarded. Only the abstract DNA profile (themes, emotions, aesthetics, origins, taste — never individual titles) is stored in the database. The raw list never touches SQLite or ChromaDB.

### 2. Recommendations Are Grounded, Not Hallucinated
**Risk:** Asking an LLM to recommend specific films or artists risks hallucinated titles — fake media attributed to real cultures.

**Resolution:** The `content_library` ChromaDB collection is seeded with real, human-verified titles and tags. `bridge_mapper.py` performs vector similarity search to retrieve grounded titles, then passes only those titles to Claude to write contextual explanations. Claude's role is limited to language — it cannot invent a title.

### 3. User Consent Before DNA Extraction
**Risk:** Extracting a psychological/cultural profile from behaviour data without explicit user agreement.

**Resolution:** The `DNAVerification.jsx` step is mandatory before any profile is saved. Users see exactly what was extracted, can edit any tag, and must actively confirm. The `source` field in `dna_profiles` distinguishes `extracted` (AI-generated) from `verified_edit` (user-confirmed) so future logic can weight them differently.

### 5. DNA Tag Validation on Save
**Risk:** A user could craft a forged API call to write arbitrary data into their stored DNA profile.

**Resolution:** `_validate_dna_tags()` in `main.py` enforces structure and content rules on every `/api/verify-dna` and `/api/users/me/dna` request: each key must be a list, max 10 tags per category, each tag must match a character whitelist and length limit.

### 6. Rate Limiting DNA Extraction
**Risk:** API cost abuse or bulk scraping of cultural inference via repeated extraction calls.

**Resolution:** In-memory rate limiting in `main.py` caps DNA extraction at 3 calls per user per day (`_DNA_DAILY_LIMIT = 3`), returning HTTP 429 on excess.

### 7. Institutional Email Gate
**Risk:** The platform is designed for university students; open registration could dilute trust.

**Resolution:** `validate_edu_email()` in `auth.py` requires `.edu`, `.ac.uk`, or equivalent institutional domain. This also creates a natural trust signal for peer matching (users know everyone on the platform is a student).

### 8. Password Security
**Risk:** Plain-text or weakly hashed passwords.

**Resolution:** bcrypt hashing via `passlib`. Passwords are never returned in any API response; `_safe_user()` strips `hashed_password` before serialisation.


---

## Social Impact

### The Problem
International students are the fastest-growing segment of US higher education — over 1 million enrolled annually. Studies consistently show that cultural adjustment difficulties, not academic performance, drive the highest dropout and transfer rates in the first year. The core issue is not language; it is the absence of cultural anchors — shared references, places, and people that make a place feel like home.

### Why Existing Solutions Fall Short
- **University orientation programmes** are one-size-fits-all and do not adapt to individual cultural background
- **Social media** accelerates connection within existing cultural bubbles, reinforcing isolation
- **Buddy programmes** are opt-in, infrequent, and depend on coordinator bandwidth

### CommonThread's Approach
Rather than treating culture as a barrier to overcome, CommonThread treats it as a bridge to build across. By mapping what a student already loves — the emotional texture of their film taste, the aesthetic register of their music — and finding its nearest equivalent in the new environment, the platform enables genuine cultural connection without asking anyone to abandon their identity.

**Measurable outcomes the platform supports:**
- Reduced time to first meaningful local peer connection
- Higher engagement with local cultural scene (recommendations are grounded in what locals actually consume)
- Increased sense of belonging, a key predictor of academic retention
- Reciprocal benefit: local students gain exposure to international cultural perspectives through the same matching system

### Scale Potential
The architecture is state-agnostic. Indiana is the pilot; expanding to any US state requires only seeding the `local_profiles` and `content_library` ChromaDB collections with that state's data. The DNA extraction and bridge logic require no changes.

1. The "Panopticon" Risk (Privacy & Surveillance)
The Harm: Asking students for their raw YouTube history and book lists feels like "Digital Strip-Searching." If this data leaks, a student’s private interests are exposed.
we do not store raw data we have a common datastore that is anonynmous
The system only stores the "DNA" (e.g., Nostalgia), which is an abstract interpretation, not the raw data. Even if the database is breached, the hacker finds "Themes," not "Watch History."

2. The "Stereotype Machine" Risk (Algorithmic Bias)
The Harm: AI (like Claude) might rely on Western-centric tropes. It might see "Sufi Music" and lazily label it "Middle Eastern Religion" instead of seeing the "Aesthetic of Transcendence."

The Wrestling: You’ve acknowledged that the AI isn't the "Source of Truth"—the User is.

The Mitigation:

The Validation Step: By forcing a "Review & Edit" screen before the DNA is finalized, you empower the user to correct the AI.

4. The "Digital Ghetto" Risk (Algorithmic Echo Chambers)
The Harm: If you only match people with "90% identical DNA," you might accidentally keep international students in a bubble where they only talk to people exactly like them, hindering integration.

The Wrestling: You built the "Bridge" and "Blind Spot" features specifically to prevent this.

5. Safety & The ".edu" Shield
The Harm: "Matching" apps can be used by bad actors for harassment or stalking.

The Wrestling: You’ve restricted the population to a verified community.
---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | — | Create account (institutional email required) |
| POST | `/api/login` | — | Authenticate, receive JWT |
| GET | `/api/me` | JWT | Current user profile |
| POST | `/api/extract-dna` | JWT | Extract DNA from raw media inputs |
| POST | `/api/verify-dna` | JWT | Confirm and save DNA profile |
| PATCH | `/api/users/me/dna` | JWT | Update saved DNA |
| POST | `/api/bridge` | JWT | Get 5-category cultural bridge recommendations |
| POST | `/api/blindspots` | JWT | Get 3 cross-cultural discovery recommendations |
| POST | `/api/match` | JWT | Find peers by DNA similarity |
| POST | `/api/conversations` | JWT | Open or retrieve a conversation |
| GET | `/api/conversations` | JWT | List all conversations |
| GET | `/api/conversations/{id}/messages` | JWT | Message history |
| WS | `/ws/chat/{id}?token=` | JWT | Real-time chat |

---

## Running the Project

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python seed_content.py        # seed content_library (run once)
python seed_locals.py         # seed local_profiles (run once)
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Set `ANTHROPIC_API_KEY` in `backend/.env`. Optionally set `ANTHROPIC_MODEL` to override the default (`claude-haiku-4-5-20251001`).
