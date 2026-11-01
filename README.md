# 🇮🇳 PolicySetu AI (पॉलिसी-सेतू)
### Multilingual Policy & Scheme Explainer for Rural Citizens
**Built for the NxtWave Launchpad Forge Hackathon**

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![LangChain LCEL](https://img.shields.io/badge/LangChain-LCEL-1C3C3C?style=flat&logo=langchain&logoColor=white)](https://langchain.com)
[![Qdrant Hybrid](https://img.shields.io/badge/Qdrant-Hybrid_RAG-DC2626?style=flat&logo=qdrant&logoColor=white)](https://qdrant.tech)
[![Rule 4 Compliant](https://img.shields.io/badge/Rule_4-Zero_Dummy_Data-10B981?style=flat)](#rule-4-zero-dummy-data-compliance)

---

## 📌 The Real-World Problem
When new Indian government welfare schemes (such as Kharif drought relief, PMFBY crop loss subsidies, or state agricultural input grants) are announced, they are published as dense, 40-page legal PDFs in English or official state Gazette language.

A rural farmer or smallholder cannot read these documents, understand the legal jargon, or determine their specific entitlement. This information asymmetry forces citizens to rely on middlemen who charge exorbitant fees just to tell them what they are legally entitled to.

## 💡 The Solution: PolicySetu AI
A web-based Digital Public Infrastructure (DPI) conversational voice platform powered by:
1. **Regional Speech & Text Console:** Multilingual queries in Gujarati, Marathi, Telugu, Hindi, and English transcribed and translated via **Sarvam Saaras AI** and **Google Gemini**.
2. **Deterministic Pre-Processing:** Spoken traditional land units (Acres, Gunthas, Bighas, Cents) normalized into standard Hectares in pure Python.
3. **Live Public RAG & Telemetry:** Concurrently queries **Qdrant Cloud Hybrid Search**, **Open-Meteo** (live rainfall deficit & drought triggers), and **OpenStreetMap Overpass** (nearest Common Service Center / Jan Seva Kendra / Maha E-Seva Kendra) via `asyncio.gather`.
4. **Grounded LCEL Adjudication:** LangChain structured output chain (Gemini 2.5 Flash) strictly citing official Government Resolutions (GRs).
5. **Synchronized Regional Audio Playback:** Real-time audio scrub bar synchronized with HTML5 audio events and 60 FPS requestAnimationFrame, paired with an interactive 3-document checklist and clickable Google Maps navigation.
6. **Mobile-First Responsive Interface:** Built with dynamic viewport height (`100dvh`), sub-tab mobile switching between Citizen Chat and CSC Telemetry, ensuring complete accessibility on devices ranging from compact phones (iPhone SE) to desktop workstations.

---

## 🏗️ System Architecture & Data Flow

```
                      CITIZEN ON WEB BROWSER
    (Spoken Voice / Vernacular Text: "મારી પાસે જામનગરમાં 50 વીઘા જમીન છે, શું મને સહાય મળશે?")
                               │
                               ▼
        ┌───────────────────────────────────────────┐
        │        React 19 + TypeScript Web App      │
        │  • Native WebM/Opus MediaRecorder Audio   │
        │  • Geolocation GPS Auto-Detection         │
        └─────────────────────┬─────────────────────┘
                              │ HTTP POST (/api/query or /api/voice-upload)
                              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                 FastAPI Async Pipeline                       │
  │                                                              │
  │  Stage 1: Sarvam Saaras AI (Regional STT -> English + LID)   │
  │  Stage 2: LangChain LCEL Chain 1 (CitizenProfile Extraction) │
  │  Stage 3: Deterministic Unit Converter (50 Vigha -> 4.0 Ha)  │
  │                                                              │
  │  Stage 4: Concurrent Live Retrieval (asyncio.gather in ~1.1s)│
  │    ├── Qdrant Cloud Hybrid RAG (State & Mandate Vectors)     │
  │    ├── Open-Meteo API (Live Rainfall Deficit & Dry Spells)   │
  │    ├── OpenStreetMap Overpass (Nearest Jan Seva Kendra)      │
  │    └── Data.gov.in REST API (Official Agriculture Stats)     │
  │                                                              │
  │  Stage 5: LangChain LCEL Chain 2 (SchemeVerdict Grounding)   │
  │                                                              │
  │  Stage 6: Regional Translation + Sarvam Indic Speech TTS     │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
        ┌─────────────────────────────────────────────────────────┐
        │               Live Citizen Response Payload             │
        │  • Synchronized HTML5 Vernacular Audio Player           │
        │  • Estimated Entitlement Summary (₹80,000 Payout)       │
        │  • Exact 3 Required Documents Checklist                 │
        │  • Interactive OpenStreetMap + Google Maps Navigation   │
        │  • Multi-Turn Persistent Scrollable Conversation History│
        └─────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
policySetuAi/
├── .env.example             # Clean template with instructions for all free API keys
├── .env                     # Active configuration (fill in your keys)
├── Dockerfile               # Production container with system ffmpeg
├── docker-compose.yml       # Unified containerized deployment
├── requirements.txt         # Production-locked Python dependencies
├── README.md                # Master documentation & defense cheat sheet
│
├── app/                     # Core FastAPI Backend
│   ├── __init__.py          # Application package initialization
│   ├── main.py              # Entrypoint, /api/query, /api/voice-upload, /api/health, /api/telemetry, static SPA serving
│   ├── config.py            # Typed Pydantic Settings & environment validation
│   ├── ingest_service.py    # Table-preserving markdown extraction & Qdrant upsert engine
│   ├── unit_converter.py    # Deterministic Acre / Guntha / Bigha / Cent -> Hectare math
│   ├── live_apis.py         # Async clients: OpenStreetMap Overpass, Open-Meteo, Data.gov.in
│   ├── rag_chains.py        # Multi-state LangChain LCEL chains (CitizenProfile & SchemeVerdict)
│   ├── speech.py            # Sarvam Saaras (STT), Indic TTS, and Gemini translation fallback
│   └── db_session.py        # Supabase 24h memory + telemetry (with local SQLite fallback)
│
├── frontend/                # React 19 + TypeScript + Vite + Tailwind CSS Application
│   ├── src/
│   │   ├── components/      # Modular UI Components
│   │   │   ├── CitizenVoiceMirror.tsx   # Vernacular chat console, audio player, & history
│   │   │   ├── CSCMapCard.tsx           # Nearest CSC locator with OpenStreetMap iframe
│   │   │   ├── TelemetryCard.tsx        # Agro-weather deficit metrics & trigger indicators
│   │   │   ├── MandateIngestionView.tsx # Live Mandate Ingestion & Qdrant Indexer
│   │   │   ├── MarkdownTableRenderer.tsx# Markdown Table Visualizer
│   │   │   └── Navbar.tsx               # DPI Tricolor header & responsive navigation
│   │   ├── services/api.ts  # REST client for FastAPI backend with blob URL handling
│   │   ├── types/index.ts   # Canonical TypeScript data contracts
│   │   ├── App.tsx          # Root container with 100dvh mobile fit & sub-tab switcher
│   │   └── index.css        # Tricolor styling & custom keyframe animations
│   ├── vite.config.ts       # Reverse proxy to FastAPI port 8000
│   └── package.json         # React 19, Lucide, Tailwind CSS dependencies
│
├── ingestion/               # Government Mandate Ingestion Pipeline
│   ├── __init__.py          # Ingestion package initialization
│   ├── fetch_gov_sources.py # Live fetcher for myScheme.gov.in & State GR PDFs
│   ├── parse_documents.py   # Table-aware PDF parser (pymupdf4llm / Sarvam Vision)
│   └── index_qdrant.py      # Qdrant Hybrid (Dense + Sparse) vector indexer & retriever
│
├── tests/                   # Verification Test Suite
│   ├── __init__.py          # Test package initialization
│   ├── test_pipeline.py     # Subsystem unit tests
│   └── test_website_api.py  # End-to-end multi-state web query tests (Gujarat & Maharashtra)
│
└── data/                    # Storage (telemetry.db, audio cache, documents)
```

---

## 🛡️ Hackathon Rule Compliance & Defense Sheet

### Rule 4 & 7a: "No Dummy Data" Enforcement
* **Zero Mock Datasets:** The application connects exclusively to live backends:
  - **Open-Meteo API:** Live meteorological readings (rainfall mm, 10-day deficit, drought indicator) for the citizen's exact village/taluka. (100% free, zero key required).
  - **OpenStreetMap Nominatim + Overpass API:** Live geospatial query locating real Common Service Centres (CSC), Maha E-Seva Kendras, and Tehsildar offices with live coordinates and Google Maps navigation links. (100% free, zero key required).
  - **Data.gov.in REST API:** Official Government of India open data catalog for district agriculture statistics.
  - **Qdrant Vector DB:** Indexed directly from official state Government Resolutions (e.g. Gujarat MMKSY and Maharashtra SDRF drought relief packages).

### Rule 6: Code Ownership & Explainability
* **No Complex Autonomous Loops:** Multi-agent cyclic graphs introduce non-deterministic loops and high latency.
* **Deterministic LangChain LCEL:** Linear, typed pipe (`|`) chains:
  - `profile_prompt | llm.with_structured_output(CitizenProfile)`
  - `verdict_prompt | llm.with_structured_output(SchemeVerdict)`
* **Deterministic Unit Conversion:** LLMs frequently make arithmetic errors when converting traditional land measurements. A pure Python converter (`unit_converter.py`) handles:
  $$\text{Acres} \times 0.404686 = \text{Hectares}$$
  $$\text{Gunthas} \times 0.010117 = \text{Hectares}$$
  $$\text{Bighas} \times 0.252929 = \text{Hectares}$$
  $$\text{Cents} \times 0.004047 = \text{Hectares}$$

---

## ⚡ Zero-Cost Hackathon Setup Guide (₹0 Budget)

| Layer | Recommended Tool | Cost | Free Allowance / Fallback |
|---|---|---|---|
| **LLM & Embeddings** | Google Gemini 2.5 Flash | **₹0** | Free tier on Google AI Studio (~15 RPM, 1500 RPD) |
| **Speech STT/TTS** | Sarvam AI (Saaras + Indic TTS) | **₹0** | Free credits on signup + automatic Gemini fallback |
| **Vector Store** | Qdrant Cloud | **₹0** | Permanent free 1GB cluster (or local disk mode) |
| **Database & Media** | Supabase Postgres + Bucket | **₹0** | Free plan (or automatic built-in SQLite fallback) |
| **GIS / Service Centers** | OpenStreetMap (Overpass + Nominatim) | **₹0** | 100% free public API, zero key needed |
| **Agro / Meteorological** | Open-Meteo Live API | **₹0** | 100% free public API, zero key needed |

---

## 🚀 Quickstart: Running Locally

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env to add your keys (Gemini, Sarvam, Qdrant, etc.)
```
*(Note: If optional keys are omitted, PolicySetu AI automatically engages grounded local fallbacks so every endpoint remains fully operational).*

### 3. Ingest Government Mandates into Qdrant
```bash
python ingestion/index_qdrant.py
```

### 4. Run Automated End-to-End Tests
```bash
python tests/test_website_api.py
```

### 5. Launch the Web Application

#### Development Mode (Vite Hot-Reload + FastAPI Backend)
1. **Start FastAPI Backend:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Start Frontend Dev Server:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

#### Production Unified Mode (FastAPI Directly Serving Built React SPA)
```bash
cd frontend && npm run build && cd ..
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000` in your browser.

---

## 🐳 Docker Deployment

Run the complete unified application container:
```bash
docker compose up --build
```
Access the application at `http://localhost:8000`.
