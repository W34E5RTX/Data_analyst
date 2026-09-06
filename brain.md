# DataMind AI Project Brain

## Product

DataMind AI is a React + FastAPI data analyst and BI application. Users can upload CSV/XLS/XLSX files, inspect computed analytics, ask grounded questions, and generate PDF reports.

## Run Locally

Frontend:

```powershell
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

Backend:

```powershell
C:/Python314/python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
```

Frontend URL: `http://localhost:5173`
Backend docs: `http://localhost:8000/docs`

## Frontend

- Entry: `src/main.tsx`
- Main application: `src/App.tsx`
- Styles: `src/App.css`, `src/index.css`
- Types: `src/types/index.ts`
- API URL comes from `VITE_API_URL`, defaulting to `http://localhost:8000`.
- Main views: Overview, Datasets, Analytics, AI Analyst, Reports, Settings.
- Recharts renders computed backend chart data.

## Backend

- Entry: `backend/main.py`
- File storage: `backend/data/`
- Dataset metadata: `backend/data/datasets.json`
- Report metadata: `backend/data/reports.json`
- Analytics use Pandas and NumPy.
- Uploaded files are preserved; quality recommendations do not mutate originals.

## Important API Routes

- `GET /api/health`
- `GET /api/datasets`
- `POST /api/datasets/upload`
- `POST /api/datasets/demo`
- `GET /api/datasets/{id}/analysis`
- `POST /api/ai/chat`
- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/{id}`
- `GET /api/reports/{id}/pdf`
- `DELETE /api/reports/{id}`

## AI Analyst Rules

Numerical facts must be calculated by the backend. The analyst response is grounded in computed metrics, trends, quality values, and chart data. It must not invent numbers or claim correlation proves causation.

## Validation

```powershell
npm run lint
npm run build
C:/Python314/python.exe -m py_compile backend/main.py
```

## Deployment

- Root `Dockerfile` builds the frontend and serves it with Nginx.
- `backend/Dockerfile` runs FastAPI with Uvicorn.
- `docker-compose.yml` starts frontend and backend services.
- Current storage is local JSON/files for development. Production should use PostgreSQL, object storage, authentication, user isolation, HTTPS, and secret environment variables.

## Git

Repository: `https://github.com/W34E5RTX/Data_analyst.git`
Branch: `main`

After changes:

```powershell
git add .
git commit -m "Describe change"
git push
```
