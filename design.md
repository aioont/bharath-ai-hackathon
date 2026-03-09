# Design Document

## Project: AgriSaarthi — AI-Powered Multilingual Assistant for Farmers

> **Status:** Production-deployed on AWS (ap-south-1) · Hackathon build: AI for Bharat 2026

---

## 1. System Architecture

### 1.1 High-Level Architecture

Single-region AWS deployment (ap-south-1) with a React PWA frontend, FastAPI backend, and five distinct AI/data flows:

```
Farmer (PWA — React + TypeScript)
        |
        v
  FastAPI Backend  (/api/* · JWT auth · Rate limiting)
        |
   ┌────┴────────────────────────────────────────────────┐
   |              |              |            |           |
Flow A        Flow B         Flow C       Flow D      Flow E
AI Chat    Crop Disease    Insurance   Market/Wx    Auth/Forum
```

### 1.2 AWS Services Used

| Service | Role |
|---|---|
| Amazon Bedrock (Nova Lite) | AI chat responses, crop diagnosis |
| Amazon Bedrock (Nova Pro) | Insurance scheme reasoning |
| Bedrock Knowledge Base — Agri (XPS3ZHO4BB) | RAG for farming queries |
| Bedrock Knowledge Base — Insurance (PSTRF0TREZ) | RAG for scheme eligibility |
| Bedrock Guardrails (cbeusvsele7s) | PII + harmful content filter on all AI output |
| Rekognition Custom Labels | Plant leaf disease detection (64 classes, F1=0.942) |
| ElastiCache Valkey 7.2 (Serverless) | Response caching · TTLs 15min–24h |
| RDS PostgreSQL | Users, crops, chat history, forum, alerts, reminders |
| S3 (agri-translate-kb-mumbai) | Crop image audit trail · Knowledge Base source docs |

---

## 2. Technology Stack

### 2.1 Frontend

- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui components
- Progressive Web App (PWA) with Workbox service worker
- React Router, React Hot Toast
- Axios-based API service layer (`/src/services/api.ts`)
- Pages: Chat, Crop Health, Insurance, Market Prices, Weather, Forum, Profile, Translate, Admin

### 2.2 Backend

- Python 3.11 + FastAPI (uvicorn)
- Routes: `auth`, `chat`, `crop_health`, `crops`, `insurance`, `market`, `market_analyzer`, `weather`, `forum`, `plan`, `reminders`, `alerts`, `translate`, `news`, `evaluation`, `admin`
- APScheduler: 5 scheduled jobs — weather refresh (6h), market price scan (2h), reminder dispatch (1min), price alert check (2h), Rekognition idle stop (5min)
- psycopg2 ThreadedConnectionPool (min=2, max=10)
- httpx for async external API calls

### 2.3 AI & NLP

- **Sarvam AI**: STT (`sarvam-stt`), TTS (`bulbul:v2`), Translation (`sarvam-translate:v1`), Chat fallback (`sarvam-m`) — 15 Indian languages
- **AWS Bedrock Nova Lite** (`apac.amazon.nova-lite-v1:0`): Primary chat + crop diagnosis via `converse()` API
- **AWS Bedrock Nova Pro** (`apac.amazon.nova-pro-v1:0`): Insurance scheme ranking + eligibility reasoning
- **AWS Rekognition Custom Labels**: Plant leaf disease model (`plant-leaf-disease-detection.2026-03-07T23.08.44`) — 64 disease classes, trained on 5,077 images
- **Bedrock Guardrails**: Applied to all AI outputs via `apply_guardrail()`, circuit-breaker after 3 consecutive failures

### 2.4 Database

- **AWS RDS PostgreSQL** (agrisaarthi-db, ap-south-1)
- Tables: `users`, `farmer_crops`, `forum_posts`, `forum_answers`, `chat_conversations`, `chat_messages`, `alerts`, `alert_preferences`, `alert_logs`, `farmer_reminders`
- Connection via psycopg2 pool; `DATABASE_POOL_URL` used in production

### 2.5 Caching

- **AWS ElastiCache Valkey 7.2 Serverless** (TLS — `rediss://`)
- TTL strategy:
  - Bedrock KB responses: 1 hour
  - Translation: 24 hours
  - Common phrases: 7 days
  - Weather: 1 hour
  - Market prices: 15 minutes
  - Insurance results: 6 hours
  - News: 30 minutes
  - Crop analysis: 2 hours
  - Forum/profile: 30 minutes

### 2.6 Email

- **Resend API** (v2 SDK) — email verification codes + price/weather alert notifications
- From address: `AgriSaarthi <send@makeasite.in>`

---

## 3. Data Flows

### Flow A — AI Farming Chat
1. Sarvam STT converts voice to text (optional)
2. SHA256 cache key checked in ElastiCache (TTL 1h) → instant return on HIT
3. Bedrock Agent Runtime retrieves top-5 passages from Agri KB (XPS3ZHO4BB)
4. Bedrock Nova Lite `converse()` generates grounded answer
5. Bedrock Guardrails `apply_guardrail()` filters output
6. Sarvam Translate + TTS → farmer's language + audio
7. RDS write: conversation, tokens, response_time_ms, model used
8. ElastiCache write for future cache hits

### Flow B — Crop Disease Detection
1. Farmer uploads photo (JPG/PNG/WebP/HEIC ≤ 10 MB)
2. Rekognition `describe_project_versions()` checks model status
3. If STOPPED: `start_project_version()` daemon (30s poll, ≤20 attempts)
4. `detect_custom_labels()` returns labels sorted by confidence (MinConf 50%)
5. Image saved to S3 for audit trail
6. Bedrock Nova Lite diagnoses: disease, severity, symptoms, treatment plan
7. Fallback: Sarvam-M if Bedrock fails
8. Sarvam Translate + TTS → native language audio diagnosis
9. APScheduler auto-stops Rekognition model after 10 min idle (cost saving)

### Flow C — Insurance Advisor
1. Farmer inputs: state, crop, land size, income, season
2. Parallel: ElastiCache check (TTL 6h) + myscheme.gov.in live query
3. Bedrock Agent Runtime retrieves top-5 passages from Insurance KB (PSTRF0TREZ)
4. Bedrock Nova Pro reasons over KB + gov API + farmer profile → ranked schemes + eligibility
5. ElastiCache write (TTL 6h)
6. Sarvam Translate + TTS → per-scheme narration

### Flow D — Market Prices & Weather
1. ElastiCache check (market TTL 15min, weather TTL 1h) → < 100ms on HIT
2. On MISS: AGMARKNET/data.gov.in (market) + Open-Meteo (weather)
3. APScheduler every 2h: compare live prices vs alert thresholds → Resend email

### Flow E — Auth · Profile · Forum
1. RDS psycopg2 pool for all reads/writes
2. JWT HS256 (7-day expiry) via FastAPI dependency injection
3. Email verification via Resend (6-digit code, 15-min expiry)
4. Forum + profile responses cached in ElastiCache (TTL 30min)

---

## 4. Security Design

- JWT HS256 Bearer tokens (7-day expiry) for all authenticated endpoints
- HTTPS enforced; ElastiCache via TLS (`rediss://`)
- Bcrypt password hashing (`$2b$12$` rounds)
- Bedrock Guardrails on all LLM outputs (PII + harm detection)
- Email OTP verification before account activation
- `SECRET_KEY` from environment; `extra = "ignore"` prevents env variable leakage
- Rate limiting: 60 requests/minute per IP
- CORS origins strictly enumerated in config

---

## 5. Scalability Design

- ElastiCache Serverless: auto-scales, pay-per-use (~$9–28/month)
- RDS connection pool (min=2, max=10) prevents connection exhaustion
- APScheduler background jobs offload periodic work from request path
- Cache-first architecture eliminates repeat Bedrock KB calls (saves ~60–75% API cost)
- Nova Lite for high-frequency chat; Nova Pro only for insurance (lower frequency, higher reasoning needed)

---

## 6. Monitoring & Logging

- Python `logging` module with structured log lines (function_name, key=value pattern)
- Bedrock circuit-breaker: 3 consecutive guardrail failures → fail-open with warning
- Rekognition model lifecycle logged: start, running, stop events
- APScheduler job execution logged with row counts
- Resend email delivery logged with email ID on success

---

## 7. Deployment

- Backend: uvicorn on port 8000 (`python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0`)
- Frontend: Vite build → Nginx (`nginx.conf` included)
- Config loaded via pydantic-settings from `.env` file (must run from `backend/` directory)
- PWA: Workbox service worker for offline capability + install banner

---

## 8. Rekognition Model Details

| Metric | Value |
|---|---|
| Model version | `plant-leaf-disease-detection.2026-03-07T23.08.44` |
| Disease classes | 64 |
| Training images | 5,077 |
| Test images | 1,270 |
| Training time | 5.673 hours |
| F1 Score | 0.942 |
| Precision | 0.941 |
| Recall | 0.948 |
| Min confidence threshold | 50% |
