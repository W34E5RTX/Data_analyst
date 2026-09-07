# DataMind AI

DataMind AI turns CSV and Excel files into explainable analytics. The first vertical slice is fully connected: upload or create a demo dataset, profile it with Pandas, score quality, recommend charts, inspect computed metrics, and ask the grounded analyst for an explanation.

## Stack

- Frontend: React, TypeScript strict, Vite, Recharts, Lucide
- Backend: FastAPI, Pandas, NumPy, SciPy, scikit-learn-compatible analytics foundation
- Storage: PostgreSQL/Neon when `DATABASE_URL` is configured, with local JSON fallback for development

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

Open http://localhost:5173. Use **Try demo dataset** for a real sample CSV processed through the same pipeline as uploads, or upload a CSV/XLSX/XLS file.

### Neon dataset storage

When `backend/.env` contains a Neon `DATABASE_URL`, every upload is stored in the `datasets` table. The table stores the original file bytes in `file_data` along with the filename, file type, row count, column count, quality score, and timestamps. Supported uploads are CSV, XLSX, and XLS files up to 50 MB. Analysis and editing read and update the stored database copy. If `DATABASE_URL` is absent, the app uses `backend/data` and JSON metadata instead.

## Docker

```powershell
docker compose up --build
```

## API

- `GET /api/health`
- `GET /api/datasets`
- `POST /api/datasets/upload`
- `POST /api/datasets/demo`
- `GET /api/datasets/{id}/analysis`
- `POST /api/ai/chat`
- `GET /api/datasets/{id}/data`
- `PUT /api/datasets/{id}/data`

Interactive docs: http://localhost:8000/docs.

## Engineering notes

Numerical facts are computed in Python. The analyst response receives those facts and explicitly avoids claiming causation. Original uploads are preserved; quality recommendations do not mutate source data. For production, replace the JSON metadata adapter with PostgreSQL/SQLAlchemy, put uploads in object storage, add JWT authentication and user isolation, and connect a server-side LLM provider behind the grounded facts contract.
