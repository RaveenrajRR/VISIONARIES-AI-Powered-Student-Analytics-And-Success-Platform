# EduAI Nexus — Smart Campus Analytics

A hackathon-oriented, runnable full-stack application that unifies synthetic academic, attendance, LMS, engagement, placement, skills and feedback data. It provides a React command center, Express/Mongoose REST API, MongoDB persistence and a FastAPI service for transparent score/risk/segment/explanation/recommendation logic.

> **Important:** All bundled data is synthetic. The weights and thresholds are provisional and not scientifically validated. Risk flags are decision support, not definitive judgments. No predictive model accuracy is claimed because labeled outcomes are not supplied.

## Requirements
- Node.js 20+ (22 recommended), npm
- Python 3.11+ (3.12 recommended)
- MongoDB 7 local or MongoDB Atlas connection string

## Quick start — Windows PowerShell
Open PowerShell in the extracted `EduAI-Nexus` directory.

```powershell
Copy-Item .env.example .env
# Edit .env and set MONGODB_URI and a long random JWT_SECRET.
# Set ADMIN_EMAIL and ADMIN_PASSWORD for your own local demo admin.

# Terminal 1: AI service
cd ai-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: backend (open a new PowerShell at project root)
cd backend
npm install
npm run seed
npm run dev

# Terminal 3: import data (open a new PowerShell at project root)
cd backend
npm run import:dataset

# Terminal 4: frontend (open a new PowerShell at project root)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Sign in using the credentials you set in `.env`. Never use these local demo credentials in production. Seed creates/updates only the environment-configured admin; no hardcoded production password exists.

### Dataset import order
The CLI script reads `datasets/raw/*.csv` and loads the master students then source records. It is idempotent by stable student ID; repeat runs update existing records and record per-source import freshness. It rejects duplicate IDs, invalid numeric ranges, and source rows without a matching master student. CSVs have 600 synthetic students and 600 linked rows per source. Browser import flow supports preview and commit for admin users. For safe reset, connect to the intended local demo database and delete only the demo database/collections you own; **do not run a blanket delete against a shared/production database**.

### Explainable AI integration
The React app calls the authenticated Express API; Express loads authorized MongoDB records and sends only each student's numeric source metrics and source timestamps to FastAPI. FastAPI calculates the provisional score, risk flags, placement readiness, segments, deterministic feature contributions, and evidence-linked recommendations. The service has no mandatory LLM dependency. No predictive classifier is trained or accuracy claimed because the repository contains no labeled outcomes.

`AI_SCORE_WEIGHTS_JSON` and `AI_RISK_THRESHOLDS_JSON` are optional JSON objects in the root `.env`; defaults are the provisional weights and support thresholds documented in `docs/scoring-methodology.md`. Weights must include all seven components. `AI_SERVICE_TIMEOUT_MS` controls the Node-to-FastAPI request timeout. Score coverage is weighted source availability. Confidence is a separate **data-quality proxy** calculated from coverage and recorded source freshness, not a probability of student success; it is `null` until usable source import timestamps exist. Rerun `npm run import:dataset` after updating the importer to stamp the bundled sources. Student-level endpoints enforce self/department access; institution-wide segment and risk summaries are limited to admins and faculty scoped to their department.

### Tests and builds
```powershell
# AI tests
cd ai-service
py -m pytest

# Backend tests and compile
cd ..\backend
npm install
npm test
npm run build

# Frontend tests and production build
cd ..\frontend
npm install
npm test
npm run build
```

## Architecture and scope
Read `docs/architecture.md`, `docs/scoring-methodology.md`, `docs/api-documentation.md`, `docs/demo-script.md`, `docs/presentation-outline.md`. FastAPI Swagger UI is at `http://localhost:8000/docs`.

The AI health card in the dashboard checks the live FastAPI service. Keep MongoDB, FastAPI, the Express API, and Vite running in separate PowerShell terminals. Start the Python service from the `ai-service` folder; its configuration loader reads the repository-root `.env`.

## Role accounts
Admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` by `npm run seed`. Faculty/student accounts can be created by an institution-controlled provisioning workflow; the current package includes role/department/student ownership enforcement in the API, but not a public self-registration UI. Create faculty/student records through a secured administrative provisioning script or extend the admin account-management UI before real deployment.

## Security / limitations
- Set a long random `JWT_SECRET`, restrict CORS, use HTTPS in hosted environments and use least-privilege MongoDB credentials.
- Logout is stateless JWT client-side removal; revocation lists are not implemented.
- Backend database connection failures are logged and cause a clear startup failure. Frontend displays API errors and empty states.
- Trend aggregation is currently an explicit empty response rather than fabricated trend data. The dashboard displays actual counts and current-page department distribution; it does not yet implement every requested longitudinal analytics/report workflow.
- The browser CSV preview uses a simple parser for standard unquoted CSV cells; CLI import uses `csv-parse` and is the recommended path for bundled data. Production uploads should use a streaming parser and stronger per-field validation.
- Express API endpoint contracts are documented in `docs/api-documentation.md`; FastAPI publishes OpenAPI automatically. Do not deploy with synthetic records mixed into real student records without clear tenant/source separation.
- No real service deployment was performed as part of packaging. See `deployment/README.md` for Vercel, Render and Atlas guidance and free-tier caveats.
