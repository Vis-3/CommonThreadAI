# 🧵 CommonThread

> **Helping international students feel culturally at home  faster.**

CommonThread maps what you already love — the emotional texture of your films, the aesthetic register of your music — and finds its nearest equivalent in your new environment. Culture isn't a barrier to overcome; it's a bridge to build across.

---

## 📽️ Demo

<!-- Add your video demo here -->
> 🎬 [CommonThread Demo](https://drive.google.com/file/d/15EzhwXnxe_Fxt6diF5A1rkqktFlB3PPO/view?usp=sharing)


---

## ✨ What It Does

A student enters their media diet — YouTube channels, movies, music, books, and food — and CommonThread extracts an abstract **Cultural DNA** profile representing their themes, emotions, aesthetics, origins, and taste. That DNA is then used to:

| Feature | Description |
|---|---|
| 🧬 **Visualise Identity** | Interactive mind-map of your 5 DNA dimensions as interconnected honeycomb clusters |
| 🌉 **Bridge to Local Culture** | Surface films, music, books, restaurants, and YouTube content loved by US students with matching taste |
| 🔭 **Surface Blind Spots** | Recommend culturally different works that share deep thematic resonance with your DNA |
| 🤝 **Connect with Peers** | Match with US-based students who share similar cultural DNA, with real-time chat built in |

---

## 🗺️ User Flow

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

## 🛠️ Tech Stack

### Backend — Python / FastAPI

| Component | Technology | Role |
|---|---|---|
| API server | FastAPI + Uvicorn | REST endpoints, WebSocket chat |
| Database | SQLite + aiosqlite | Users, conversations, messages, DNA profiles |
| Vector store | ChromaDB (persistent) | `local_profiles` + `content_library` collections |
| LLM | Anthropic Claude Haiku 4.5 | DNA extraction, recommendations, blind spot curation |
| Auth | JWT (HS256) + bcrypt | Token-based auth, hashed passwords |
| Input safety | Regex validation + rate limiting | Tag sanitisation, 3 DNA extractions/day per user |

### Frontend — React 19 / Vite

| Component | Technology |
|---|---|
| UI framework | React 19 + Vite |
| State management | Zustand (`useDNAStore`) |
| Styling | Tailwind CSS + inline styles |
| Real-time chat | Native WebSocket API |
| Visualisation | Hand-written SVG (no chart library) |

---

## 🏗️ Architecture

### Two-Collection ChromaDB Design

The system uses two completely separate ChromaDB collections to enforce a strict **privacy boundary**:

**`content_library`** — anonymous, tagged cultural content
- 338 items across 5 types: film, music, local_scene, book, youtube
- Used exclusively for recommendations — Claude never invents titles, only writes "why it fits" explanations

**`local_profiles`** — for peer matching and chat only
- Used only to surface user IDs for the chat feature
- Raw preference lists from this collection are never exposed in recommendations

### SQLite Schema

```sql
users            — id, username, display_name, email, hashed_password, state, dna_profile, dna_verified
dna_profiles     — id, user_id, profile (JSON), source ('extracted'|'verified_edit'), created_at
conversations    — id, user_a_id, user_b_id, created_at
messages         — id, conversation_id, sender_id, content, created_at
content_items    — id, title, type, tags (JSON), created_at
```

---

## 🔐 Ethics & Safety

CommonThread was designed with safety and consent at every layer:

| Risk | Mitigation |
|---|---|
| **Raw data exposure** | Raw inputs are discarded after DNA extraction — only abstract tags (e.g. "Nostalgia") are stored, never individual titles |
| **Hallucinated recommendations** | `content_library` is seeded with human-verified titles; Claude writes explanations only, never invents content |
| **Unconsented profiling** | `DNAVerification.jsx` is a mandatory review-and-edit step before any profile is saved |
| **Algorithmic bias** | Users can correct AI-generated tags; the user is always the source of truth |
| **Echo chambers** | The "Bridge" and "Blind Spots" features are specifically designed to break cultural bubbles |
| **Bad actors** | Registration is gated to verified `.edu` / `.ac.uk` institutional emails |
| **API abuse** | In-memory rate limiting caps DNA extraction at 3 calls/user/day |
| **Weak passwords** | bcrypt hashing via `passlib`; passwords never returned in any API response |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Seed the databases (run once)
python seed_content.py      # seeds content_library
python seed_locals.py       # seeds local_profiles

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `ANTHROPIC_MODEL` | Optional | Override default model (default: `claude-haiku-4-5-20251001`) |

---

## 📡 API Reference

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

## 🌍 Social Impact

Over **1 million international students** enrol in US higher education annually. Research consistently shows that cultural adjustment difficulties — not academic performance — drive the highest dropout rates in Year 1. CommonThread addresses this directly:

- 📉 Reduced time to first meaningful local peer connection
- 🎭 Higher engagement with the local cultural scene (recommendations are grounded in what locals actually consume)
- 🏫 Increased sense of belonging — a key predictor of academic retention
- 🔄 Reciprocal benefit: local students gain exposure to international cultural perspectives through the same matching system

### Scale Potential

The architecture is **state-agnostic**. Indiana is the pilot. Expanding to any US state (or country) requires only re-seeding the `local_profiles` and `content_library` ChromaDB collections. The DNA extraction and bridge logic require zero changes.

---

## 📁 Project Structure

```
commonthread/
├── backend/
│   ├── main.py                   # FastAPI app, auth, rate limiting
│   ├── dna_extractor.py          # Claude prompting → structured DNA
│   ├── bridge_mapper.py          # Vector search + Claude explanations
│   ├── blind_spot.py             # Cross-cultural thematic matching
│   ├── matcher.py                # Peer similarity search
│   ├── chat.py                   # WebSocket connection manager
│   ├── seed_content.py           # One-time content_library seeding
│   ├── seed_locals.py            # One-time local_profiles seeding
│   ├── content_library.json      # Curated, tagged cultural content
│   ├── cultural_dataset.json     # Blind spot source data
│   └── local_profiles_indiana.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── InputUploader.jsx      # Media entry across 5 categories
    │   │   ├── DNAVerification.jsx    # Review & edit extracted DNA
    │   │   ├── MindMap.jsx            # Interactive SVG mind map
    │   │   ├── BridgeResults.jsx      # Recommendations + peer cards
    │   │   ├── ChatWindow.jsx         # Real-time WebSocket chat
    │   │   ├── BlindSpots.jsx         # Cross-cultural discovery
    │   │   └── Inbox.jsx              # Conversation list
    │   └── store/
    │       └── useDNAStore.js         # Zustand global state
    └── vite.config.js
```

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">Built with ❤️ for students far from home.</p>
