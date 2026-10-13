# EduAI Nexus — No-Database Demo

This Express API uses predefined synthetic records in `src/data/demoData.js`. It does not connect to MongoDB or any other database. Runtime edits to interventions/audit logs are held in memory and reset on restart.

## Run on Windows PowerShell
```powershell
npm install
Copy-Item .env.example .env
npm run dev
```
API health check: http://localhost:4000/api/health

## Demo accounts
- Admin: `admin@eduai.demo` / `Admin@123`
- Student 1: `student@eduai.demo` / `Student@123`
- Student 2: `student02@eduai.demo` / `Student@123`

These are demo credentials, not real Gmail accounts. Google/Gmail OAuth is not implemented. Use synthetic data only.

## Role separation
- Admin/faculty: institution-wide directory, dashboard, analytics and intervention endpoints.
- Student: own profile and own interventions only. Backend checks the student ID from the signed token; hiding a link in the frontend is not the security boundary.

## Endpoints
- `GET /api/health`
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/dashboard/overview`
- `GET /api/students`, `GET /api/students/:id`, `GET /api/students/:id/{score,risks,explanations,recommendations,segment,placement}`
- `GET /api/interventions`, `POST /api/interventions`, `PATCH /api/interventions/:id`
- `GET /api/analytics/trends`, `/segments`, `/risk-summary`, `/placement-summary`
- `GET /api/courses`, `GET /api/audit-logs`, `GET /api/reports/export`

All scores and records are illustrative synthetic demo data, not validated predictions or real student information.
