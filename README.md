# CommonThread — Build Guide for Claude Code

> **Cultural identity & connection platform for university students navigating new places.**
> Verified university students map their cultural DNA from what they love, bridge it to their new locality, and optionally connect with others making the same journey.

---

## What You're Building

CommonThread has **5 core features** and **2 stretch features**:

| Priority | Feature | Description |
|---|---|---|
| ✅ Core 1 | **Auth & .edu Verification** | Register with institutional email + state. Verified university identity only. |
| ✅ Core 2 | **Cultural DNA Extractor** | Parse uploaded history exports or manually entered titles → extract themes, emotions, aesthetics |
| ✅ Core 3 | **DNA Verification Step** | User reviews and edits their extracted DNA before it's saved — catches hallucinations |
| ✅ Core 4 | **Living Mind Map** | D3.js force graph that expands in real time as the user interacts |
| ✅ Core 5 | **Locality-Anchored Discovery** | Two paths: (A) Bridge your DNA to your new locality, or (B) Find others with shared blind spots |
| 🔶 Stretch 1 | **Cultural Bridge Mapper** | Cross-cultural recommendations with explainable "why", anchored to user's current state |
| 🔶 Stretch 2 | **Shared Discovery Playlists** | 3 films + 2 albums + 1 book two matched users explore together |

### Core Philosophy

The **primary goal is cultural discovery** — helping people understand their own taste and find meaningful bridges to their new environment. Connecting with another person is a **secondary, optional endpoint**, not the success metric. The flow is:

1. Extract & verify DNA
2. Choose a path: **Integrate Locally** or **Connect with Others**
3. Get deep, explainable recommendations based on shared blind spots
4. Optionally open a chat with a matched user

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Mind Map | React Force Graph (or D3.js) |
| AI / LLM | Google Gemini API (`gemini-1.5-flash`) |
| State Management | Zustand |
| Embeddings & vector search | ChromaDB (local) |
| Cultural dataset / RAG | LangChain + a curated JSON dataset you'll seed |
| Matching algorithm | Cosine similarity on taste-graph embeddings |
| Real-time chat | WebSockets (FastAPI native) |
| Chat persistence | SQLite via `aiosqlite` |
| Auth | JWT tokens via `python-jose` + `.edu` email validation |
| Backend API | FastAPI (Python) |
| Package manager | npm (frontend) + pip (backend) |

---

## Project Structure

```
commonthread/
├── backend/
│   ├── main.py               # FastAPI app — all API routes + WebSocket
│   ├── dna_extractor.py      # Cultural DNA extraction via Gemini
│   ├── bridge_mapper.py      # Locality-anchored bridge recommendations
│   ├── blind_spot.py         # Explainable blind-spot surfacing
│   ├── matcher.py            # Cosine-similarity matching on verified profiles
│   ├── chat.py               # WebSocket manager + message persistence
│   ├── auth.py               # JWT auth + .edu email validation
│   ├── db.py                 # SQLite setup (users, conversations, messages)
│   ├── vector_store.py       # ChromaDB setup and helpers
│   ├── cultural_dataset.json # Seed data: works tagged by culture + themes
│   ├── locality_dataset.json # Seed data: works/events tagged by US state + themes
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/
│   │   │   └── useDNAStore.js       # Zustand store for DNA profile + app state
│   │   ├── components/
│   │   │   ├── AuthGate.jsx         # .edu registration + login
│   │   │   ├── InputUploader.jsx    # Step 1 — upload export or paste titles
│   │   │   ├── DNAVerification.jsx  # Step 2 — user reviews/edits extracted DNA
│   │   │   ├── MindMap.jsx          # Step 3 — living force graph
│   │   │   ├── PathChooser.jsx      # Step 4 — "Integrate Locally" vs "Connect"
│   │   │   ├── BridgeResults.jsx    # Path A — locality-anchored recs
│   │   │   ├── BlindSpots.jsx       # Path B — surfaced blind spots + match
│   │   │   ├── MatchCard.jsx        # Matched user card with optional "Start Chat"
│   │   │   └── ChatWindow.jsx       # In-app chat UI (real-time WebSocket)
│   │   ├── hooks/
│   │   │   └── useChat.js           # WebSocket connection + message state
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Validation Rules (Enforce Everywhere)

These rules must be applied consistently across all frontend forms and backend endpoints. Never rely on null checks alone.

**Username**
- Length: 3–30 characters
- Allowed characters: `[a-zA-Z0-9_]` only (Latin alphanumeric + underscore)
- Regex: `^[a-zA-Z0-9_]{3,30}$`

**Display name**
- Length: 2–50 characters
- Allowed characters: `[a-zA-Z0-9 '\-]` (Latin letters, numbers, space, apostrophe, hyphen)
- Regex: `^[a-zA-Z0-9 '\-]{2,50}$`

**Password**
- Length: 8–128 characters
- Must include at least one letter and one number
- No character set restriction (supports unicode passwords)

**Email**
- Must match `.edu` TLD pattern or recognised international institutional domains (`.ac.uk`, `.edu.au`, `.ac.in`, etc.)
- Regex for US .edu: `^[a-zA-Z0-9._%+\-]{1,64}@[a-zA-Z0-9.\-]{1,255}\.edu$`
- For international: also accept domains ending in `.ac.[a-z]{2}` or `.edu.[a-z]{2}`
- Max total length: 254 characters

**State / Location**
- Must be a value from a fixed allowlist of US states (and territories if desired)
- No free-text — use a dropdown in the frontend, validate the value server-side against the same list

**DNA text inputs (YouTube titles, books, music)**
- Max 200 lines per field
- Max 300 characters per line
- Max 5,000 characters total per field
- Allowed characters per line: `[a-zA-Z0-9 .,'\-\(\)&:!?]` — Latin characters, numbers, and common punctuation only
- Strip and reject lines that contain script characters outside this set before sending to the LLM (prevents prompt injection)

**DNA verification edits (themes, emotions, aesthetics)**
- Each tag: 2–60 characters
- Allowed: `[a-zA-Z0-9 \-]`
- Max 10 tags per category

Apply all validation in both the frontend (for UX feedback) and the backend (for security). Backend is the source of truth.

---

## Step-by-Step Build Instructions

### Step 1 — Bootstrap the project

```bash
mkdir commonthread && cd commonthread

# Backend
mkdir backend && cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn google-generativeai chromadb langchain \
            python-dotenv aiosqlite python-jose[cryptography] passlib[bcrypt]

# Frontend (back in root)
cd ..
npm create vite@latest frontend -- --template react
cd frontend && npm install
npm install react-force-graph tailwindcss @tailwindcss/vite axios zustand
```

Create `.env` in `backend/`:

```
GEMINI_API_KEY=your_key_here
JWT_SECRET=any_long_random_string_here
```

---

### Step 2 — Seed the cultural and locality datasets

**Prompt Claude Code:**

```
Create backend/cultural_dataset.json with at least 60 entries.
Each entry must have:
- title (string)
- creator (string)
- type: "film" | "album" | "book"
- culture_of_origin (string, e.g. "South Indian", "Japanese", "Iranian")
- themes: string[] (e.g. ["longing", "magical realism", "spiritual journey"])
- emotions: string[] (e.g. ["melancholy", "transcendence", "warmth"])
- aesthetic: string[] (e.g. ["lush cinematography", "minimalist", "poetic prose"])

Include works from at least 12 distinct cultural origins.
```

**Prompt Claude Code:**

```
Create backend/locality_dataset.json with at least 40 entries covering 8–10 US states.
Each entry must have:
- title (string)
- creator (string)
- type: "film" | "album" | "book" | "event_type" | "place_type"
- state (string, e.g. "Indiana", "California", "New York")
- themes: string[] — same vocabulary as cultural_dataset
- emotions: string[]
- aesthetic: string[]
- locality_note: string — one sentence on why this is culturally significant to that state

This is the RAG source for locality-anchored bridging.
```

---

### Step 3 — Build Auth with .edu Verification

**File:** `backend/auth.py`

**Prompt Claude Code:**

```
Create backend/auth.py.

Use python-jose for JWT and passlib for password hashing.

Expose:
- def validate_edu_email(email: str) -> bool
  Accepts .edu domains. Also accepts international institutional patterns:
  domains ending in .ac.uk, .edu.au, .ac.in, .ac.nz, .edu.sg, and similar.
  Rejects all other domains.
  Validates against regex: length limits + allowed character set as per project rules.

- def hash_password(plain: str) -> str
- def verify_password(plain: str, hashed: str) -> bool
- def create_token(user_id: str, username: str) -> str  (expires in 7 days)
- def decode_token(token: str) -> dict | None

Field validation (enforce in backend, not just frontend):
- username: regex ^[a-zA-Z0-9_]{3,30}$
- display_name: regex ^[a-zA-Z0-9 '\-]{2,50}$
- password: 8–128 chars, at least one letter and one number
- state: must be in the US_STATES allowlist defined in this file
- email: must pass validate_edu_email()

Define US_STATES as a set of full state names ("Indiana", "California", etc.)
Raise HTTPException with a clear message for any validation failure.
```

**File:** `backend/db.py`

**Prompt Claude Code:**

```
Create backend/db.py using aiosqlite.

Create four tables on startup:
1. users:
   - id (UUID), username (UNIQUE), display_name, email (UNIQUE),
     hashed_password, state, university (parsed from email domain),
     dna_profile (JSON text, nullable), dna_verified (boolean, default false),
     created_at

2. conversations:
   - id (UUID), user_a_id, user_b_id, created_at

3. messages:
   - id (UUID), conversation_id, sender_id, content, created_at

4. dna_profiles (versioned history):
   - id (UUID), user_id, profile (JSON text), source ("extracted" | "verified_edit"),
     created_at

Expose:
- async def init_db()
- async def create_user(username, display_name, email, hashed_password, state) -> dict
- async def get_user_by_username(username) -> dict | None
- async def get_user_by_id(user_id) -> dict | None
- async def save_dna_profile(user_id, profile, source) -> dict
  (saves to dna_profiles history and updates users.dna_profile + dna_verified)
- async def get_or_create_conversation(user_a_id, user_b_id) -> dict
- async def save_message(conversation_id, sender_id, content) -> dict
- async def get_messages(conversation_id, limit=50) -> list
```

---

### Step 4 — Build the Cultural DNA Extractor

This is the most critical feature. Everything else depends on it.

**File:** `backend/dna_extractor.py`

**Prompt Claude Code:**

```
Create backend/dna_extractor.py.

It must expose one async function:
  extract_dna(inputs: dict) -> dict

`inputs` looks like:
{
  "youtube_titles": ["list of video titles"],
  "books": ["list of book titles"],
  "music": ["list of artist or album names"]
}

Input validation before calling the API:
- Each list: max 200 items
- Each item: max 300 characters
- Each item must match: ^[a-zA-Z0-9 .,'\-\(\)&:!?]{1,300}$
- Silently skip items that fail validation (do not crash)
- If all items are filtered out, raise a ValueError with a user-facing message

The function should:
1. Build a prompt for the Gemini API using google-generativeai SDK
2. Use model: gemini-1.5-flash
3. Instruct the model to respond ONLY with valid JSON, no markdown fences,
   no preamble. The JSON must have exactly these keys:
   - dominant_themes: list of 5–8 abstract themes
     (NOT genres — think "longing for home", "spiritual transcendence",
     "stories of ordinary people")
   - dominant_emotions: list of 4–6 emotional registers
   - aesthetic_signatures: list of 4–6 aesthetic patterns
     (e.g. "slow-burn narrative", "ensemble casts", "poetic imagery")
   - cultural_origins_detected: list of best-guess cultural backgrounds
   - confidence_notes: string, brief note on data quality
4. Set response_mime_type to "application/json" in the generation config
5. Parse and return the JSON dict
6. Never use genre labels like "action" or "romance" — only deep semantic themes

Load GEMINI_API_KEY from env.
```

---

### Step 5 — Build the DNA Verification Step

After extraction, users must review and confirm their DNA before it influences anything. This is the trust and accuracy layer.

**File:** `frontend/src/components/DNAVerification.jsx`

**Prompt Claude Code:**

```
Create frontend/src/components/DNAVerification.jsx.

Props:
- dnaProfile: the raw extracted DNA dict
- onVerified: (verifiedDNA) => void — called when user confirms
- onStartOver: () => void

Purpose: Let the user review what was extracted, correct any hallucinations,
and add things they want to explore.

Layout:
1. Header: "Does this look like you?"
   Subtext: "AI can miss things or get things wrong. Review and edit before we save."

2. Four editable tag sections:
   - "Themes" (from dominant_themes)
   - "Emotions" (from dominant_emotions)
   - "Aesthetic Style" (from aesthetic_signatures)
   - "Cultural Roots Detected" (from cultural_origins_detected)

   Each section shows tags as removable chips (click × to remove).
   Below each section: a small input to add a new tag + "Add" button.

   Tag validation:
   - 2–60 characters per tag
   - Regex: ^[a-zA-Z0-9 \-]{2,60}$
   - Max 10 tags per category
   - Show inline error if validation fails

3. confidence_notes shown as a soft info box below the sections.

4. Two buttons:
   - "This looks right — Save My DNA" (primary) → calls onVerified(editedDNA)
   - "Start Over" → calls onStartOver()

Store edited state locally in this component until confirmed.
Do NOT save or send anything until the user explicitly confirms.
```

---

### Step 6 — Zustand State Store

**File:** `frontend/src/store/useDNAStore.js`

**Prompt Claude Code:**

```
Create frontend/src/store/useDNAStore.js using Zustand.

Store the following state:
- currentUser: null | { id, username, display_name, email, state, university, token }
- dnaProfile: null | object  — the verified DNA dict
- dnaVerified: boolean
- pathChoice: null | "local" | "connect"
- bridgeResults: []
- blindSpots: []
- matches: []

Actions:
- setUser(user)
- setDNAProfile(profile)
- setDNAVerified(bool)
- setPathChoice(choice)
- setBridgeResults(results)
- setBlindSpots(spots)
- setMatches(matches)
- reset()  — clears everything except currentUser

Persist currentUser to localStorage (token + user info only, not DNA).
DNA profile is only held in memory during the session — never written to localStorage.
```

---

### Step 7 — Build the FastAPI Backend

**File:** `backend/main.py`

**Prompt Claude Code:**

```
Create backend/main.py using FastAPI.

Include:
1. CORS middleware allowing localhost:5173
2. Call init_db() on startup

3. POST /api/register
   - Body: { username, display_name, email, password, state }
   - Validate all fields via auth.py validation functions
   - Hash password, create user, return { token, user }

4. POST /api/login
   - Body: { username, password }
   - Return { token, user }

5. GET /api/me
   - Requires Authorization: Bearer token
   - Returns current user dict (no password hash)

6. POST /api/extract-dna
   - Requires auth
   - Body: { youtube_titles, books, music }
   - Rate limit: max 3 extractions per user per day (track in DB or in-memory dict)
   - Calls extract_dna() from dna_extractor.py
   - Returns raw DNA dict (NOT saved yet — user must verify first)

7. POST /api/verify-dna
   - Requires auth
   - Body: { dna_profile: dict, source: "extracted" | "verified_edit" }
   - Validate all tag fields against allowed character set and length limits
   - Save via save_dna_profile()
   - Returns { success: true, dna_profile }

8. PATCH /api/users/me/dna
   - Requires auth
   - Body: { dna_profile: dict }
   - Validates and updates the user's DNA (calls save_dna_profile with source="verified_edit")

9. POST /api/bridge
   - Requires auth
   - Body: { dna: dict, target_culture: string }
   - Stub for now — returns []

10. POST /api/blindspots
    - Requires auth
    - Body: { dna: dict }
    - Stub for now — returns []

11. POST /api/match
    - Requires auth
    - Body: { dna: dict }
    - Stub for now — returns []

12. GET /api/health → { status: "ok" }

Run with: uvicorn main:app --reload --port 8000
```

---

### Step 8 — Build the React Frontend Shell + Auth

**Prompt Claude Code:**

```
Set up the React frontend in frontend/src/.

App.jsx flow — render based on Zustand store state:
  - No user → <AuthGate />
  - User, no DNA verified → <InputUploader /> → <DNAVerification />
  - DNA verified, no path chosen → <PathChooser />
  - Path = "local" → <BridgeResults />
  - Path = "connect" → <BlindSpots /> (with optional <MatchCard /> and <ChatWindow />)

Global styling:
- Background: deep navy (#0a0f1e)
- Accent: warm gold (#f4b942), soft teal (#5ecfcf)
- Typography: clean sans-serif, generous spacing

Create components/AuthGate.jsx:

Two tabs: "Sign Up" and "Log In"

Sign Up form fields:
- Display name
- Username
- Institutional email (.edu or international equivalent)
- Password
- State (dropdown — all 50 US states)

Validation (show inline errors before submit):
- username: 3–30 chars, regex ^[a-zA-Z0-9_]{3,30}$
- display_name: 2–50 chars, regex ^[a-zA-Z0-9 '\-]{2,50}$
- email: must contain .edu or known institutional domain pattern
- password: 8–128 chars, at least one letter and one number
- state: must be selected from the dropdown (no free text)

On submit: POST /api/register → store token + user in Zustand + localStorage → proceed

Log In form: username + password → POST /api/login → same

Show a note below the sign-up form:
"CommonThread is for university students only. A valid institutional email is required."
```

---

### Step 9 — Build the Input Uploader

**File:** `frontend/src/components/InputUploader.jsx`

**Prompt Claude Code:**

```
Create frontend/src/components/InputUploader.jsx.

Two input modes — toggle between them with a tab at the top:

MODE A — "Upload Export Files":
- Three file upload zones:
  1. YouTube watch history (accepts watch-history.json — Google Takeout format)
  2. Music history (accepts Last.fm export CSV or Spotify extended history JSON)
  3. Book list (accepts plain .txt, one title per line, or Goodreads export CSV)
- Parse the uploaded files in the browser before sending to the backend.
  Extract title strings only. Do NOT send raw file contents to the backend.
- Show a preview of the first 5 parsed titles under each zone.

MODE B — "Type or Paste":
- Three text areas:
  1. YouTube video titles (one per line, max 200 lines, max 5000 chars total)
  2. Books read (one per line)
  3. Music / artists (one per line)
- Character counter below each field.

Shared validation before submit:
- Each item: max 300 characters, regex ^[a-zA-Z0-9 .,'\-\(\)&:!?]{1,300}$
- Silently skip invalid items, show a count: "X items will be skipped (unsupported characters)"
- At least 5 valid items total across all fields required to submit

"Map My Cultural DNA" button:
- On click: POST to /api/extract-dna (include Authorization header from store)
- While loading: pulsing animation with "Reading your cultural DNA..."
- On success: call onDNAExtracted(result) prop to advance to DNAVerification

Include a "Load Demo Data" button that pre-fills all fields with test data
(Priya's data — see Step 10).
```

---

### Step 10 — Build the Living Mind Map

**File:** `frontend/src/components/MindMap.jsx`

**Prompt Claude Code:**

```
Create frontend/src/components/MindMap.jsx using react-force-graph-2d.

Props: dnaProfile (the verified DNA dict)

Behaviour:
1. On mount, convert dnaProfile into a graph:
   - Central node: "You" (gold, large)
   - Theme nodes: one per dominant_theme (teal, medium)
   - Emotion nodes: one per dominant_emotion (soft purple, small)
   - Aesthetic nodes: one per aesthetic_signature (soft white, small)
   - Connect all to the central node with labelled edges

2. Nodes spawn with a gentle staggered animation — 200ms between each —
   so the graph visibly builds in front of the user.

3. Central "You" node has a subtle pulsing glow.

4. On hover: tooltip with the node's label.

5. Summary card below the graph:
   "Your cultural DNA spans [cultural_origins_detected joined by ', ']"
   "Core themes: [dominant_themes as comma list]"

6. Stats bar: "[N] themes detected · [N] cultural origins · [N] aesthetic signatures"

7. "Continue" button that calls onContinue() prop to advance to PathChooser.

Use a dark canvas background matching the app theme.
```

---

### Step 11 — Build the Path Chooser

This is the key UX fork. Users choose what they want right now — integrate locally or find others. This determines which feature loads.

**File:** `frontend/src/components/PathChooser.jsx`

**Prompt Claude Code:**

```
Create frontend/src/components/PathChooser.jsx.

Props:
- userState: string (the user's registered state, e.g. "Indiana")
- onChoose: (path: "local" | "connect") => void

Display two large option cards side by side:

Card A — "Explore [userState]":
- Icon: map pin or compass
- Headline: "Bridge your culture to [userState]"
- Description: "Find films, music, and books from [userState]'s cultural scene
  that connect directly to what you already love."
- Button: "Show me [userState] connections"

Card B — "Find Your People":
- Icon: two overlapping circles
- Headline: "Find others on the same journey"
- Description: "Match with other students whose taste points toward
  the same blind spots as yours."
- Button: "Find my matches"

Selecting a card calls onChoose("local") or onChoose("connect").

Style: both cards equal weight — neither is presented as the "main" option.
This is the user's choice, not the app's.
```

---

### Step 12 — Build the Cultural Bridge Mapper (Path A)

**File:** `backend/bridge_mapper.py`

**Prompt Claude Code:**

```
Create backend/bridge_mapper.py.

Expose: async def get_bridge_recommendations(dna: dict, user_state: str) -> list[dict]

Load both cultural_dataset.json and locality_dataset.json.

Use the Gemini API (gemini-1.5-flash) to:
1. Take the user's DNA (themes, emotions, aesthetics) and their current US state
2. Find 4–6 works from locality_dataset.json for that state that share thematic
   and emotional DNA with the user
3. For each, generate an explanation in 1–2 sentences:
   WHY does this connect to the user's taste specifically?
   Anchor the explanation to the locality:
   e.g. "Your love of slow meditative pacing maps to the stillness of the
   Indiana plains that runs through this album."
4. Return: [{ title, creator, type, state, why_it_fits, locality_note }]

Instruct the model to respond only in JSON. No markdown, no preamble.
The "why" is mandatory — never return a recommendation without it.

Update POST /api/bridge in main.py to call this, passing the current user's
state from their auth token (not from the request body — users cannot override
their own state in this call).
```

**Frontend component:**

**Prompt Claude Code:**

```
Create frontend/src/components/BridgeResults.jsx.

Props: bridgeResults, userState

Header: "Your cultural DNA → [userState]"
Subtitle: "Works from [userState]'s cultural scene that share your exact themes"

Each recommendation as a card:
- Title + creator (prominent)
- Type badge: Film | Album | Book | Event Type | Place Type
- Why you'll love this: why_it_fits text with a gold left-border accent
- locality_note in a soft highlighted box

Animate cards in with a slide-up effect on mount.
```

---

### Step 13 — Build Blind Spot Surfacing (Path B)

**File:** `backend/blind_spot.py`

**Prompt Claude Code:**

```
Create backend/blind_spot.py.

Expose: async def surface_blind_spots(dna: dict) -> list[dict]

Logic:
1. Load cultural_dataset.json
2. Use Gemini (gemini-1.5-flash) to find 3 works from cultures DIFFERENT from
   the user's detected origins that share deep thematic overlap.
3. For each, generate:
   - title, creator, type, culture_of_origin
   - blind_spot_reason: "You've never encountered X but your love of [theme]
     means you'd find it immediately recognisable" (1–2 sentences, specific)
   - discovery_hook: one vivid specific detail connecting to something in the user's DNA
4. Return list of 3 dicts.

Respond only in JSON. No markdown fences, no preamble.

Update POST /api/blindspots in main.py to call this.
```

**Prompt Claude Code:**

```
Create frontend/src/components/BlindSpots.jsx.

Props:
- blindSpots: list of { title, creator, type, culture_of_origin,
  blind_spot_reason, discovery_hook }
- onFindMatch: () => void

Section title: "Your Blind Spots — Works You Were Born to Love"
Subtitle: "From cultures you haven't explored — but your DNA says you should."

Each card:
- "BLIND SPOT" label in teal
- Title + creator
- blind_spot_reason in italic
- discovery_hook in a gold-tinted highlighted box
- Type + culture badge

Below the blind spots, a separator and a button:
"Find someone who shares these blind spots →"
On click: calls onFindMatch() which triggers the match API and shows <MatchCard />

The button is secondary — blind spots are the primary content on this screen.
Animate cards in with a slide-up effect on mount.
```

---

### Step 14 — Build Matching

**File:** `backend/matcher.py`

**Prompt Claude Code:**

```
Create backend/matcher.py.

Expose: async def find_matches(current_user_id: str, dna: dict) -> list[dict]

Logic:
1. Fetch all users from DB who have dna_verified = true and are NOT the current user.
2. For each candidate, compute overlap score:
   - Shared themes / total unique themes × 100 (rounded to nearest integer)
3. For the top 3 matches by overlap score:
   - Compute shared_blind_spots: themes in both DNAs not in their cultural_origins_detected
   - Generate 0 ice-breakers (removed — we surface shared blind spots instead)
4. Return list of up to 3 dicts:
   { user_id, display_name, university, state, overlap_score, shared_blind_spots }

If fewer than 3 real matches exist (e.g. in early demo), generate simulated profiles
to fill the gap. Label simulated profiles clearly with "simulated": true in the dict.

Update POST /api/match in main.py to call this.
```

**Prompt Claude Code:**

```
Create frontend/src/components/MatchCard.jsx.

Props:
- match: { user_id, display_name, university, state, overlap_score,
           shared_blind_spots, simulated }
- currentUser: { id, display_name, token }
- onChatOpen: (conversationId, otherUser) => void

Display:
- Display name + university + state
- Overlap score as a visual bar (e.g. "73% taste overlap")
- Shared Blind Spots section: list the shared_blind_spots titles as cards
  with a brief label "You both point toward this"
- If match.simulated === true: show a clearly visible banner at the top of the card:
  "Simulated match — real matching requires more users. Your DNA extraction was real."

Optional chat button (secondary, below the content):
- Label: "Compare notes →"
- On click:
  1. POST /api/conversations with { other_user_id: match.user_id }
  2. Call onChatOpen(conversationId, match)
- If match.simulated === true: disable this button, show tooltip
  "Chat only available with real users"

The card should feel complete without the chat button — shared blind spots
are the primary content.
```

---

### Step 15 — Build In-App Chat (Optional Endpoint)

Chat is a secondary, opt-in feature. Build it last.

**Backend:**

**Prompt Claude Code:**

```
Create backend/chat.py.

Build a WebSocket connection manager:

class ConnectionManager:
  - active_connections: dict[conversation_id → list[WebSocket]]
  - connect(websocket, conversation_id)
  - disconnect(websocket, conversation_id)
  - async broadcast(message_dict, conversation_id)

In main.py, add:

WebSocket route: /ws/chat/{conversation_id}?token={jwt}
- On connect: decode token to get sender_id. Reject if invalid.
- Join conversation room via ConnectionManager.
- On receive: save message via save_message(), then broadcast:
  { message_id, sender_id, sender_name, content, created_at }
- On disconnect: remove from room.

REST route: GET /api/conversations/{conversation_id}/messages
- Requires Authorization: Bearer token
- Returns last 50 messages

REST route: POST /api/conversations
- Body: { other_user_id }
- Creates or retrieves conversation
- Returns { conversation_id }
```

**Frontend:**

**Prompt Claude Code:**

```
Create frontend/src/hooks/useChat.js

Props: { conversationId, token, currentUser }

State:
- messages: []
- inputValue: ""
- connectionStatus: "connecting" | "connected" | "disconnected"

Behaviour:
- On mount: fetch last 50 messages from GET /api/conversations/{conversationId}/messages
- Open WebSocket: ws://localhost:8000/ws/chat/{conversationId}?token={token}
- On incoming message: append to messages
- sendMessage(text): send over WebSocket
- On unmount: close WebSocket cleanly

Return: { messages, inputValue, setInputValue, sendMessage, connectionStatus }
```

**Prompt Claude Code:**

```
Create frontend/src/components/ChatWindow.jsx

Props:
- conversationId (string)
- otherUser: { display_name, dna_profile, shared_blind_spots }
- currentUser: { id, display_name }
- token (JWT string)
- onClose: () => void

Use the useChat hook.

Layout (full-screen modal or right-side panel):

1. Header bar:
   - Other user's display name + university
   - "X% taste overlap" badge
   - Close button

2. Shared Blind Spots panel (pinned at top, always visible):
   - Title: "What you both point toward"
   - List the shared_blind_spots as small chips
   This replaces ice-breakers — the shared discovery is the context for the chat.

3. Message list (scrollable, newest at bottom):
   - My messages: right-aligned, gold background
   - Their messages: left-aligned, dark teal background
   - Timestamp below each block ("2:34 PM")
   - Auto-scroll on new message

4. Input bar:
   - Text input (Enter or Send button)
   - "Connected" / "Reconnecting..." status dot

5. If connectionStatus === "disconnected": banner "Reconnecting..."

Animate new messages in with slide-up fade.
```

---

### Step 16 — Wire Everything Together

**Prompt Claude Code:**

```
Wire the full App.jsx flow using the Zustand store:

1. No user → show <AuthGate />
   On auth: setUser() in store, proceed

2. User logged in, no verified DNA → show <InputUploader />
   On extraction: advance to <DNAVerification />

3. <DNAVerification />: user reviews and edits extracted DNA
   On confirm: POST /api/verify-dna → setDNAProfile() + setDNAVerified(true) → show <MindMap />

4. <MindMap />: shows the verified DNA as a force graph
   On continue: show <PathChooser />

5. <PathChooser />: user selects "local" or "connect"
   On choose: setPathChoice() in store, proceed

   Path A ("local"):
   POST /api/bridge with { dna, target_culture: user.state }
   setBridgeResults() → show <BridgeResults />

   Path B ("connect"):
   Simultaneously:
   - POST /api/blindspots with { dna } → setBlindSpots() → show <BlindSpots />
   - POST /api/match with { dna } → setMatches() → show <MatchCard /> for top match

6. When user clicks "Compare notes" on a MatchCard:
   POST /api/conversations → open <ChatWindow /> as an overlay
   MatchCard stays visible behind the chat — do not unmount it.

7. Handle all loading states with a spinner + short status message.
8. Handle all API errors with a friendly error card — no crashes.
9. "Start Over" button resets non-auth state via store.reset().
```

---

### Step 17 — Demo Data

**Prompt Claude Code:**

```
Create frontend/src/data/demoData.js

Export a const demoData = {
  youtube_titles: [
    // 15 realistic YouTube titles suggesting South Indian cinema, Sufi music,
    // Indian classical, magical realism content, migration documentaries
    // e.g. "Dil Se | Full Movie", "Nusrat Fateh Ali Khan Live Concert 1994"
    // "The Namesake — Official Trailer", "AR Rahman: The Spirit of Music"
  ],
  books: [
    // 8 book titles: magical realism, South Asian fiction, literary fiction
    // e.g. "The God of Small Things", "The Namesake", "Midnight's Children"
  ],
  music: [
    // 10 artists/albums: Sufi, Carnatic classical, AR Rahman, crossover
  ]
}

In InputUploader.jsx, "Load Demo Data" button pre-fills all three fields
with this data in both modes.
```

---

### Step 18 — Final Polish

**Prompt Claude Code:**

```
Final polish pass:

1. Hero header with text-based CommonThread logo and tagline:
   "Your culture is the bridge — not the thing you have to leave behind."

2. Step progress indicator (Step 1 of N → Step 2 of N) showing current position in flow.

3. Ensure the living mind map nodes animate in sequentially, not all at once.

4. On BridgeResults, show which state is being bridged to prominently.

5. On BlindSpots, the "Find someone who shares these" button should be visually secondary
   to the blind spot cards — smaller, below the fold.

6. Ensure the app is fully usable at 1280×800.

7. Final check: no console errors, no broken imports, all API calls handled,
   all auth headers included on protected routes.
```

---

## Running the App

```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## Build Timeline (48 Hours)

| Hours | Steps | Goal |
|---|---|---|
| 0–6 | 1–4 | Auth, DB, DNA extraction working end-to-end |
| 6–10 | 5–6 | Zustand store + frontend auth shell |
| 10–16 | 7–9 | Input uploader, DNA verification, mind map |
| 16–22 | 10–13 | Path chooser, bridge mapper, blind spots |
| 22–28 | 14 | Matching with real + simulated fallback |
| 28–34 | 15 | In-app chat (WebSockets, DB, ChatWindow) |
| 34–38 | 16–17 | Full wire-up, demo data, error handling |
| 38–48 | 18 | Polish, rehearsal, real data testing |

---

## Key Constraints

- **Primary goal is cultural discovery.** Chat is a secondary endpoint, not the success metric. Recommendations must be deep and explainable before anything else.
- **User chooses their path.** "Integrate locally" and "connect with others" are equal options — neither is the default or primary CTA.
- **DNA verification is mandatory.** Never save or act on extracted DNA without user confirmation.
- **No nationality as input.** DNA extraction reads behaviour only — never ask "where are you from."
- **Always show the "why."** Every recommendation must include an explanation tied to the user's DNA. No naked title lists.
- **Local processing for inputs.** Raw input data (YouTube titles, book lists) is validated and discarded after extraction. Only the verified DNA graph is saved.
- **Simulated matches must be labelled.** Clearly show "simulated" on any generated match profile. Disable chat for simulated users.
- **Rate limit the DNA endpoint.** Max 3 extractions per user per day — it calls Gemini.
- **Validate everything twice.** Frontend validation for UX, backend validation for security. Backend is always the source of truth.

---

## What Wins This Demo

The living mind map building in real time is your single most powerful visual. The DNA verification step makes the product honest and gives users agency. The path chooser respects that not everyone wants to connect with strangers — some just want to find their footing in a new place. Judges who see a student's taste graph expand node by node, then watch it bridge to Indiana films they'd never heard of, will remember CommonThread.

*Build something that matters.*
