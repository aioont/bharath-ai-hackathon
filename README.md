# Agri-Translate AI 🌾

> **Empowering India's 270 million farmers with Multilingual AI**  
> PWA web app powered by Amazon Bedrock · Amazon Translate · Open-Meteo

---

## Features

| Feature | Technology |
|---|---|
| 🌐 Multilingual Translation (22 languages) | Sarvam Translate (sarvam-translate:v1) |
| 🤖 AI Farming Assistant | Sarvam-M (hybrid reasoning LLM) |
| 🔬 Crop Disease Diagnosis | Sarvam Vision (vision-language model) |
| 📈 Live Mandi Prices | data.gov.in (AGMARKNET) |
| 🌤 7-Day Weather Forecast | Open-Meteo (free) |
| 💬 Community Forum | FastAPI + Supabase PostgreSQL |
| 🗄 Image Storage | AWS S3 (minimal) |
| ⚡ Response Cache | AWS ElastiCache Redis (minimal) |
| 📱 PWA (works offline) | Vite PWA + Workbox |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.11
- AWS account (optional – demo mode works without credentials)

---

### 1. Clone & configure

```bash
git clone https://github.com/your-org/agri-translate-ai.git
cd agri-translate-ai
cp backend/.env.example backend/.env
# Edit backend/.env and add your AWS credentials (optional)
```

---

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs → http://localhost:8000/docs

---

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App → http://localhost:5173

---

### 4. Build for production

```bash
# Frontend
cd frontend && npm run build   # outputs to frontend/dist/

# Backend (behind Nginx / AWS ALB)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in values:

| Variable | Description | Required |
|---|---|---|
| `AWS_REGION` | AWS region (default `ap-south-1`) | No |
| `AWS_ACCESS_KEY_ID` | AWS credentials | No* |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | No* |
| `BEDROCK_MODEL_ID` | Claude model ID | No |
| `DATA_GOV_API_KEY` | data.gov.in API key (free) | No |
| `DATABASE_URL` | PostgreSQL URL | No (SQLite fallback) |

\* Without AWS credentials the app runs in **demo mode** with realistic mock data.

---

## Architecture (AWS)

```
Browser (PWA)
    │
    ▼
CloudFront (CDN)
    │
    ├──► S3 (static assets / React build)
    │
    └──► ALB → ECS Fargate (FastAPI)
                │
                ├──► Sarvam AI  (Sarvam-M chat + Sarvam Translate + Sarvam Vision)
                ├──► Supabase PostgreSQL  (forum data, user data)
                ├──► AWS S3              (crop image uploads — minimal AWS)
                ├──► AWS ElastiCache     (Redis cache — minimal AWS)
                └──► Open-Meteo API      (weather, free)
```

---

## Tech Stack

**Frontend:** React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · vite-plugin-pwa · Framer Motion · Recharts · Lucide React

**Backend:** FastAPI · Python 3.11 · sarvamai SDK · psycopg2 · boto3 · Pydantic v2 · httpx · structlog

**AI:** Sarvam-M (chat/reasoning) · Sarvam Translate (22 Indian languages) · Sarvam Vision (crop disease)

**Database:** Supabase PostgreSQL

**AWS (minimal):** S3 (image uploads) · ElastiCache Redis (response cache) · CloudFront · ECS Fargate

---

## License

MIT © 2024 Agri-Translate AI
