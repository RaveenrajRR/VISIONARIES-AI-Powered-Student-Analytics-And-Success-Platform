# EduAI Nexus Frontend

React + Vite frontend paired with the `backend/` no-database demo API.

## Run on Windows PowerShell
Terminal 1:
```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```
Terminal 2:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open http://localhost:5173. Vite proxies `/api` requests to `http://127.0.0.1:4000`.

## Demo logins
- Admin: `admin@eduai.demo` / `Admin@123`
- Student: `student@eduai.demo` / `Student@123`
- Student 2: `student02@eduai.demo` / `Student@123`

Admin sees institution-wide dashboard, student directory, analytics and admin settings. A student sees their own dashboard/profile and only their own record is returned by the backend. All data is synthetic. Credentials are demo-only, not Gmail passwords.
