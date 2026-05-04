# CRI / Feature Request Workflow (Hackathon 2026)

Multi-agent system that extracts, classifies, prioritizes, and routes customer requests to JIRA — with human-in-the-loop verification at every stage.

## Architecture

```
Streamlit UI  ──HTTP──►  FastAPI Backend  ──►  PostgreSQL + pgvector
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
               Agent-1    Agent-2    JIRA Service
             (Extraction) (Classify)  (Create ticket)
                    │         │
                    ▼         ▼
               Anthropic / OpenAI API
```

### Workflow

1. **Upload** a document (PDF / DOCX / TXT / MD).
2. **Agent-1** extracts structured fields (title, problem statement, requirements, impact, product areas) with evidence spans grounded in the document.
3. **Uploader reviews** the extraction, edits if needed, and approves.
4. **Agent-2** classifies the request (Feature / CRI / Bug / Production Bug), computes a deterministic priority score, and suggests an owning team.
5. **PM reviews** classification and priority, overrides if needed, and approves.
6. **JIRA ticket** is created automatically with all structured data and the original file attached.

Every step is auditable — all artifacts, edits, and approvals are versioned and stored.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Streamlit (multi-page) |
| Backend API | FastAPI (async) |
| Database | PostgreSQL 16 + pgvector |
| ORM | SQLAlchemy 2.0 + Alembic |
| LLM | Anthropic Claude / OpenAI GPT-4o (configurable) |
| Doc Parsing | pdfplumber, python-docx |
| JIRA | atlassian-python-api |
| Containers | Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) An Anthropic or OpenAI API key for real LLM extraction
- (Optional) JIRA Cloud credentials for real ticket creation

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys (or leave blank for mock mode)
```

### 2. Start everything

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** (with pgvector) on port 5432
- **FastAPI backend** on http://localhost:8000 (API docs at /docs)
- **Streamlit frontend** on http://localhost:8501

### 3. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Open the dashboard

Navigate to http://localhost:8501

## Running Locally (without Docker)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL separately (with pgvector extension)
# Then run migrations:
alembic upgrade head

# Start the API:
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

## API Documentation

With the backend running, visit http://localhost:8000/docs for the interactive OpenAPI documentation.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/documents` | Upload a document (multipart) |
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/{id}` | Get run details + artifacts |
| POST | `/api/runs/{id}/agent1` | Trigger Agent-1 extraction |
| POST | `/api/runs/{id}/approve/uploader` | Uploader approves extraction |
| POST | `/api/runs/{id}/approve/pm` | PM approves classification |
| GET | `/api/audit/{run_id}` | Full audit trail |
| GET | `/api/admin/scoring-config` | Get scoring weights |
| PUT | `/api/admin/scoring-config` | Update scoring weights |
| GET | `/api/admin/team-mappings` | List team mappings |
| POST | `/api/admin/team-mappings` | Add team mapping |

## Mock Mode

If no LLM API key or JIRA credentials are configured, the system runs in **mock mode**:
- Agent-1 and Agent-2 return plausible mock responses.
- JIRA creation returns a mock ticket key (MOCK-XXXXXX).

This lets you demo the full workflow end-to-end without external dependencies.

## Project Structure

```
cb-hackathon-26/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py            # Settings
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models/              # ORM models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── api/                 # REST endpoints
│   │   ├── services/            # Business logic
│   │   └── agents/              # LLM prompts + client
│   └── alembic/                 # DB migrations
├── frontend/
│   ├── app.py                   # Streamlit home
│   ├── api_client.py            # HTTP client
│   ├── pages/                   # Multi-page UI
│   └── components/              # Reusable widgets
└── uploads/                     # Local file storage
```

## Configuration

### Scoring Weights (Admin UI)

| Dimension | Default Weight | Description |
|-----------|---------------|-------------|
| ARR | 30 | Annual recurring revenue impact |
| Escalation | 25 | Escalation level / urgency signals |
| Strategic | 20 | Strategic deal / partnership value |
| Severity | 15 | Technical severity |
| Affected Customers | 10 | Breadth of customer impact |

Priority thresholds: High >= 70, Medium >= 40, Low < 40. All configurable via Admin page.
