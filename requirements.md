# Requirements Document

## Project: AgriSaarthi — AI-Powered Multilingual Assistant for Farmers

> **Status:** Implemented & deployed · AI for Bharat 2026 Hackathon (Hack2Skill × AWS)

---

## 1. Overview

AgriSaarthi is a full-stack, AI-powered Progressive Web App (PWA) that supports Indian farmers in 15 regional languages. It combines AWS Bedrock generative AI, Rekognition Custom Labels for crop disease detection, real-time market and weather data, and government insurance scheme discovery — all delivered in the farmer's native language via text and voice.

---

## 2. Objectives

- Deliver agricultural knowledge grounded in a verified knowledge base (RAG) in 15 Indian languages.
- Identify crop diseases from leaf photos with >94% F1 accuracy using a custom-trained Rekognition model.
- Match farmers to eligible government insurance schemes using AI reasoning over live government APIs.
- Provide real-time mandi prices and weather forecasts with sub-100ms cached responses.
- Enable voice-first interaction through Sarvam STT/TTS for low-literacy users.
- Persist chat history, crops, forum posts, alerts, and reminders in a managed PostgreSQL database.

---

## 3. Target Users

- Small and medium-scale farmers (primary)
- Rural agricultural workers
- Agricultural extension officers
- Farmers seeking government insurance/subsidy information

---

## 4. Functional Requirements

### 4.1 User Management ✅ Implemented

- Email + password registration with 6-digit OTP email verification (Resend API, 15-min expiry)
- JWT HS256 authentication (7-day token expiry)
- Language preference selection (15 languages)
- Profile: full name, state, district, farming type, phone
- Crop portfolio management: crop name, area (acres), soil type, season, irrigation method

### 4.2 Multilingual Support ✅ Implemented

- 15 Indian languages: Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Maithili, Urdu, Rajasthani, Sanskrit
- Sarvam Translate (`sarvam-translate:v1`) for text translation
- Sarvam TTS (`bulbul:v2`) for audio output
- Sarvam STT for voice input
- Translation results cached 24h in ElastiCache (common phrases 7 days)

### 4.3 AI Farming Chat ✅ Implemented

- Bedrock Nova Lite (`apac.amazon.nova-lite-v1:0`) via `converse()` API
- RAG: Bedrock Knowledge Base (Agriculture KB ID: XPS3ZHO4BB) — OpenSearch + Titan Embeddings, top-5 passages
- Guardrails (`apply_guardrail()`) on all responses — PII + harmful content
- Responses cached in ElastiCache (TTL 1h) by SHA256(message + language)
- Full conversation history stored in RDS (`chat_conversations`, `chat_messages`)
- Fallback: Sarvam-M if Bedrock unavailable

### 4.4 Crop Disease Detection ✅ Implemented

- AWS Rekognition Custom Labels model: 64 plant disease classes
- Training: 5,077 images · Test: 1,270 images · F1: 0.942 · Precision: 0.941 · Recall: 0.948
- Minimum confidence threshold: 50%
- Auto-start model on demand; auto-stop after 10 min idle (cost optimisation)
- Diagnosis (symptoms, treatment, prevention) via Bedrock Nova Lite in farmer's language
- Leaf images stored to S3 for audit trail
- Supported formats: JPG, PNG, WebP, HEIC (max 10 MB)

### 4.5 Insurance Advisor ✅ Implemented

- Inputs: state, crop, land size, annual income, season
- Parallel fetch: ElastiCache (TTL 6h) + myscheme.gov.in live API
- RAG: Insurance KB (ID: PSTRF0TREZ) via Bedrock Agent Runtime
- Bedrock Nova Pro (`apac.amazon.nova-pro-v1:0`) for scheme ranking + eligibility reasoning
- Results cached 6h in ElastiCache
- Audio narration per scheme via Sarvam TTS

### 4.6 Weather Integration ✅ Implemented

- Open-Meteo API — hourly + daily forecasts
- Farming-specific advice derived from forecast data
- Cached in ElastiCache (TTL 1h)
- APScheduler refreshes every 6h
- Weather-triggered email alerts via Resend

### 4.7 Market Price Information ✅ Implemented

- AGMARKNET / data.gov.in APIs for live mandi prices
- Cached in ElastiCache (TTL 15min)
- APScheduler scans every 2h — compares live price vs user-set alert threshold
- Price alert email notifications via Resend API
- Market analyzer: trend analysis and price insights

### 4.8 Smart Alerts & Reminders ✅ Implemented

- User-configurable price alerts stored in RDS (`alerts`, `alert_preferences`)
- Farmer reminders stored in RDS (`farmer_reminders`) — types: fertilizer, irrigation, pesticide, harvest, sowing, general
- APScheduler dispatches due reminders every minute
- Email delivery via Resend SDK v2
- In-app alert log (`alert_logs`)

### 4.9 Farmer Forum ✅ Implemented

- Forum posts and answers stored in RDS (`forum_posts`, `forum_answers`)
- Cached reads (TTL 30min) in ElastiCache
- JWT-protected write endpoints

### 4.10 Plan Generator ✅ Implemented

- AI-generated seasonal farming plans based on crop type and profile
- Powered by Bedrock Nova Lite with Agri KB context

### 4.11 News Feed ✅ Implemented

- Agriculture news aggregation
- Cached in ElastiCache (TTL 30min)

### 4.12 Crop-to-Text Translation ✅ Implemented

- General-purpose text translation (Sarvam Translate)
- Accessible via dedicated `/translate` page

---

## 5. Non-Functional Requirements

### 5.1 Performance ✅ Met

- ElastiCache HIT response: < 100ms
- Bedrock KB response: ~1–3s (cached after first call)
- Rekognition inference: < 2s (model already RUNNING)
- Rate limit: 60 requests/minute per client

### 5.2 Scalability ✅ Designed For

- ElastiCache Valkey 7.2 Serverless: auto-scales, pay-per-use
- RDS connection pool (min=2, max=10) configurable
- APScheduler offloads background work from web workers
- PWA enables offline access to cached content

### 5.3 Security ✅ Implemented

- HTTPS enforced; ElastiCache via TLS (`rediss://`)
- JWT HS256 tokens with configurable `SECRET_KEY`
- Bcrypt password hashing (12 rounds)
- Email OTP verification before account activation
- Bedrock Guardrails on all LLM outputs
- CORS origins strictly limited to known frontend URLs
- Input validated via Pydantic schemas
- Rate limiting via FastAPI middleware

### 5.4 Usability ✅ Implemented

- Voice-first: STT input + TTS output on Chat and Crop Health pages
- Language selector on every page
- Simple card-based UI with TailwindCSS
- PWA installable on Android/iOS home screen
- Offline banner when connectivity is lost

---

## 6. Constraints & How Addressed

| Constraint | Resolution |
|---|---|
| Limited rural connectivity | PWA + Workbox service worker for offline caching |
| Regional language NLP accuracy | Sarvam AI (purpose-built for Indian languages) with 24h translation cache |
| Rekognition model cold-start (~2–3 min) | Auto-start daemon + frontend status polling every 8s |
| Bedrock API cost | ElastiCache caching eliminates ~60–75% of repeat KB calls |
| Data privacy | Guardrails PII detection + Bcrypt + JWT + TLS everywhere |

---

## 7. Implemented Enhancements (vs Original Plan)

- ✅ Government scheme integration (myscheme.gov.in + Insurance KB)
- ✅ PWA offline mode (Workbox)
- ✅ AI evaluation dashboard (`/eval` endpoint + EvalDashboard page)
- ✅ Admin panels: cache management, DB table viewer
- ✅ Mock IoT endpoint (`mock_iot.py`) for future soil sensor integration
- ✅ Market analyzer with AI-powered trend insights
