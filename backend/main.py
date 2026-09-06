from __future__ import annotations

import json
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import FileResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph
from sqlalchemy import Boolean, Column, Integer, LargeBinary, MetaData, String, Table, Text, create_engine, insert, select, text
from sqlalchemy.engine import Engine

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
METADATA_FILE = DATA_DIR / "datasets.json"
REPORTS_FILE = DATA_DIR / "reports.json"
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_TYPES = {".csv", ".xlsx", ".xls"}
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
database_engine: Engine | None = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
db_metadata = MetaData()
datasets_table = Table("datasets", db_metadata, Column("id", String(64), primary_key=True), Column("name", String(255), nullable=False), Column("rows", Integer, nullable=False), Column("columns", Integer, nullable=False), Column("quality_score", Integer, nullable=False), Column("status", String(32), nullable=False), Column("file_type", String(16), nullable=False), Column("created_at", String(64), nullable=False), Column("size_bytes", Integer, nullable=False), Column("file_data", LargeBinary, nullable=False))
reports_table = Table("reports", db_metadata, Column("id", String(64), primary_key=True), Column("name", String(255), nullable=False), Column("dataset_id", String(64), nullable=False), Column("dataset_name", String(255), nullable=False), Column("type", String(80), nullable=False), Column("status", String(32), nullable=False), Column("created_at", String(64), nullable=False), Column("summary", Text, nullable=False), Column("analysis", Text, nullable=False))
if database_engine:
    db_metadata.create_all(database_engine)

app = FastAPI(title="DataMind AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_metadata() -> list[dict[str, Any]]:
    if not METADATA_FILE.exists():
        return []
    return json.loads(METADATA_FILE.read_text(encoding="utf-8"))


def save_metadata(items: list[dict[str, Any]]) -> None:
    METADATA_FILE.write_text(json.dumps(items, indent=2, default=str), encoding="utf-8")


def read_reports() -> list[dict[str, Any]]:
    if not REPORTS_FILE.exists():
        return []
    return json.loads(REPORTS_FILE.read_text(encoding="utf-8"))


def save_reports(items: list[dict[str, Any]]) -> None:
    REPORTS_FILE.write_text(json.dumps(items, indent=2, default=str), encoding="utf-8")


def database_ready() -> bool:
    return database_engine is not None


def db_dataset(item: dict[str, Any], file_data: bytes) -> dict[str, Any]:
    return {key: item[key] for key in ("id", "name", "rows", "columns", "quality_score", "status", "file_type", "created_at", "size_bytes")} | {"file_data": file_data}


def database_dataset_rows() -> list[dict[str, Any]]:
    if not database_ready():
        return []
    with database_engine.connect() as connection:
        return [dict(row._mapping) for row in connection.execute(select(datasets_table).order_by(datasets_table.c.created_at.desc()))]


def dataset_record(dataset_id: str) -> dict[str, Any] | None:
    if database_ready():
        with database_engine.connect() as connection:
            row = connection.execute(select(datasets_table).where(datasets_table.c.id == dataset_id)).first()
            if row:
                record = dict(row._mapping)
                record["path"] = str(DATA_DIR / f"{record['id']}.{record['file_type']}")
                return record
    return next((item for item in read_metadata() if item["id"] == dataset_id), None)


def persist_dataset(item: dict[str, Any], file_data: bytes) -> None:
    if database_ready():
        with database_engine.begin() as connection:
            connection.execute(insert(datasets_table).values(**db_dataset(item, file_data)))
    else:
        items = read_metadata()
        items.insert(0, item)
        save_metadata(items)


def persist_report(report: dict[str, Any]) -> None:
    if database_ready():
        with database_engine.begin() as connection:
            connection.execute(insert(reports_table).values(id=report["id"], name=report["name"], dataset_id=report["dataset_id"], dataset_name=report["dataset_name"], type=report["type"], status=report["status"], created_at=report["created_at"], summary=report["summary"], analysis=json.dumps(report["analysis"])))
    else:
        items = read_reports()
        items.insert(0, report)
        save_reports(items)


def database_reports() -> list[dict[str, Any]]:
    if not database_ready():
        return read_reports()
    with database_engine.connect() as connection:
        rows = connection.execute(select(reports_table).order_by(reports_table.c.created_at.desc())).mappings()
        return [{**dict(row), "analysis": json.loads(row["analysis"])} for row in rows]


def report_record(report_id: str) -> dict[str, Any] | None:
    return next((item for item in database_reports() if item["id"] == report_id), None)


def load_frame(dataset: dict[str, Any]) -> pd.DataFrame:
    if database_ready() and dataset.get("file_data") is not None:
        source = io.BytesIO(dataset["file_data"])
        return pd.read_csv(source) if dataset["file_type"] == "csv" else pd.read_excel(source)
    path = Path(dataset["path"])
    return pd.read_csv(path) if dataset["file_type"] == "csv" else pd.read_excel(path)


def profile_frame(frame: pd.DataFrame) -> dict[str, Any]:
    numeric = frame.select_dtypes(include=np.number).columns.tolist()
    dates = [column for column in frame.columns if pd.api.types.is_datetime64_any_dtype(frame[column])]
    categorical = [str(column) for column in frame.columns if column not in numeric and column not in dates]
    columns = []
    for column in frame.columns:
        series = frame[column]
        columns.append({"name": str(column), "type": str(series.dtype), "nulls": int(series.isna().sum()), "unique": int(series.nunique(dropna=True))})
    return {"numeric_columns": numeric, "categorical_columns": categorical, "date_columns": dates, "columns": columns}


def quality_frame(frame: pd.DataFrame) -> dict[str, Any]:
    missing = int(frame.isna().sum().sum())
    duplicates = int(frame.duplicated().sum())
    numeric = frame.select_dtypes(include=np.number)
    outliers = 0
    if not numeric.empty:
        for column in numeric.columns:
            values = numeric[column].dropna()
            if len(values) > 3:
                q1, q3 = values.quantile([0.25, 0.75])
                outliers += int(((values < q1 - 1.5 * (q3 - q1)) | (values > q3 + 1.5 * (q3 - q1))).sum())
    cells = max(frame.size, 1)
    score = max(0, round(100 - ((missing / cells) * 60) - ((duplicates / max(len(frame), 1)) * 25) - min(outliers / max(len(frame), 1) * 15, 15)))
    recommendations = []
    if missing:
        recommendations.append("Review columns with missing values before modeling.")
    if duplicates:
        recommendations.append("Review duplicate rows before using trend metrics.")
    if outliers:
        recommendations.append("Investigate numeric outliers; they may represent events or data quality issues.")
    return {"score": score, "missing_values": missing, "duplicate_rows": duplicates, "outliers": outliers, "recommendations": recommendations or ["No immediate quality issues detected."]}


def analysis_for(dataset: dict[str, Any]) -> dict[str, Any]:
    frame = load_frame(dataset)
    profile = profile_frame(frame)
    quality = quality_frame(frame)
    numeric = profile["numeric_columns"]
    categorical = profile["categorical_columns"]
    metrics = []
    for column in numeric[:4]:
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if values.empty:
            continue
        metrics.append({"label": f"Average {column}", "value": f"{values.mean():,.1f}", "change": f"{len(values):,} values", "trend": "neutral"})
    metrics.append({"label": "Rows analyzed", "value": f"{len(frame):,}", "change": f"{len(frame.columns)} columns", "trend": "neutral"})
    charts = []
    if numeric:
        column = numeric[0]
        values = pd.to_numeric(frame[column], errors="coerce").dropna().reset_index(drop=True)
        points = [{"label": str(index + 1), "value": round(float(value), 2)} for index, value in values.tail(24).items()]
        charts.append({"title": f"{column} over records", "kind": "area", "x_label": "Record", "y_label": column, "points": points})
    if categorical and numeric:
        category, measure = categorical[0], numeric[0]
        grouped = frame.groupby(category, dropna=True)[measure].sum().sort_values(ascending=False).head(8)
        charts.append({"title": f"{measure} by {category}", "kind": "bar", "x_label": category, "y_label": measure, "points": [{"label": str(label)[:16], "value": round(float(value), 2)} for label, value in grouped.items()]})
    insights = []
    if numeric:
        column = numeric[0]
        series = pd.to_numeric(frame[column], errors="coerce").dropna()
        insights.append({"id": "range", "severity": "info", "title": f"{column} has a broad operating range", "description": f"Values span {series.min():,.1f} to {series.max():,.1f} across the analyzed rows.", "metric": f"{series.max() - series.min():,.1f} spread"})
    insights.append({"id": "quality", "severity": "positive" if quality["score"] >= 90 else "warning", "title": "Data quality is ready for exploration", "description": quality["recommendations"][0], "metric": f"{quality['score']}/100"})
    return {"dataset": {key: value for key, value in dataset.items() if key not in ("path", "file_data")}, "metrics": metrics, "charts": charts, "insights": insights, "profile": profile, "quality": quality}


@app.get("/api/health")
def health() -> dict[str, str]:
    result = {"status": "ok", "database": "not_configured"}
    if database_engine:
        try:
            with database_engine.connect() as connection:
                connection.execute(text("select 1"))
            result["database"] = "connected"
        except Exception:
            result["database"] = "error"
    return result


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "DataMind AI API", "status": "ok", "docs": "/docs"}


@app.get("/api/datasets")
def datasets() -> list[dict[str, Any]]:
    items = database_dataset_rows() if database_ready() else read_metadata()
    return [{key: value for key, value in item.items() if key not in ("path", "file_data")} for item in items]


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_TYPES:
        raise HTTPException(400, "Only CSV, XLSX, and XLS files are supported.")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Files must be smaller than 50 MB.")
    dataset_id = str(uuid.uuid4())
    path = DATA_DIR / f"{dataset_id}{extension}"
    path.write_bytes(content)
    try:
        frame = pd.read_csv(path) if extension == ".csv" else pd.read_excel(path)
    except Exception as error:
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"Could not read this file: {error}") from error
    quality = quality_frame(frame)
    item = {"id": dataset_id, "name": file.filename, "rows": len(frame), "columns": len(frame.columns), "quality_score": quality["score"], "status": "ready", "file_type": extension[1:], "created_at": datetime.now(timezone.utc).isoformat(), "size_bytes": len(content), "path": str(path)}
    persist_dataset(item, content)
    return {key: value for key, value in item.items() if key != "path"}


@app.post("/api/datasets/demo")
def demo_dataset() -> dict[str, Any]:
    frame = pd.DataFrame({"Month": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], "Region": ["North", "South", "North", "West", "South", "West"], "Revenue": [120000, 135000, 112000, 158000, 149000, 175000], "Orders": [420, 460, 390, 540, 515, 590], "Marketing Spend": [18000, 21000, 19500, 24000, 23000, 26000]})
    dataset_id = str(uuid.uuid4()); path = DATA_DIR / f"{dataset_id}.csv"; frame.to_csv(path, index=False)
    item = {"id": dataset_id, "name": "demo_sales.csv", "rows": len(frame), "columns": len(frame.columns), "quality_score": quality_frame(frame)["score"], "status": "ready", "file_type": "csv", "created_at": datetime.now(timezone.utc).isoformat(), "size_bytes": path.stat().st_size, "path": str(path)}
    persist_dataset(item, path.read_bytes())
    return {key: value for key, value in item.items() if key != "path"}


@app.get("/api/datasets/{dataset_id}/analysis")
def dataset_analysis(dataset_id: str) -> dict[str, Any]:
    dataset = dataset_record(dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found.")
    return analysis_for(dataset)


class ChatRequest(BaseModel):
    dataset_id: str
    question: str


@app.post("/api/ai/chat")
def chat(request: ChatRequest) -> dict[str, str]:
    dataset = dataset_record(request.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found.")
    analysis = analysis_for(dataset)
    question = request.question.lower()
    metrics = analysis["metrics"]
    quality = analysis["quality"]
    if "quality" in question or "clean" in question:
        answer = f"Your dataset quality score is {quality['score']}/100. It has {quality['missing_values']} missing values, {quality['duplicate_rows']} duplicate rows, and {quality['outliers']} detected outliers."
    elif "top" in question or "best" in question or "highest" in question:
        chart = next((item for item in analysis["charts"] if item["kind"] == "bar"), None)
        if chart and chart["points"]:
            top = chart["points"][0]
            answer = f"The strongest segment in the computed breakdown is {top['label']}, with {top['value']:,.0f} in {chart['y_label']}."
        else:
            answer = "This dataset does not contain a categorical breakdown that can answer a top-performer question."
    elif "trend" in question or "changed" in question or "fall" in question or "grow" in question:
        chart = next((item for item in analysis["charts"] if item["kind"] == "area"), None)
        if chart and len(chart["points"]) >= 2:
            first, last = chart["points"][0]["value"], chart["points"][-1]["value"]
            change = ((last - first) / first * 100) if first else 0
            direction = "increased" if change >= 0 else "decreased"
            answer = f"{chart['y_label']} {direction} {abs(change):.1f}% from the first to the last available record, moving from {first:,.0f} to {last:,.0f}."
        else:
            answer = "There are not enough ordered values to calculate a reliable trend."
    else:
        facts = ", ".join(f"{metric['label']}: {metric['value']}" for metric in metrics[:3])
        answer = f"Here is a verified snapshot of {dataset['name'].replace('_', ' ')}: {facts}. The dataset quality score is {quality['score']}/100. Ask about trends, top segments, or data quality for a more specific analysis."
    return {"answer": answer}


class ReportRequest(BaseModel):
    dataset_id: str
    report_type: str = "Executive Summary"


@app.get("/api/reports")
def reports() -> list[dict[str, Any]]:
    return database_reports()


@app.post("/api/reports")
def create_report(request: ReportRequest) -> dict[str, Any]:
    dataset = dataset_record(request.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found.")
    analysis = analysis_for(dataset)
    report = {
        "id": str(uuid.uuid4()),
        "name": f"{request.report_type} - {dataset['name']}",
        "dataset_id": dataset["id"],
        "dataset_name": dataset["name"],
        "type": request.report_type,
        "status": "ready",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "summary": f"{dataset['name']} contains {dataset['rows']:,} rows across {dataset['columns']} columns with a quality score of {analysis['quality']['score']}/100.",
        "analysis": analysis,
    }
    persist_report(report)
    return report


@app.get("/api/reports/{report_id}")
def get_report(report_id: str) -> dict[str, Any]:
    report = report_record(report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    return report


@app.get("/api/reports/{report_id}/pdf")
def download_report_pdf(report_id: str) -> FileResponse:
    report = report_record(report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    pdf_path = DATA_DIR / f"{report_id}.pdf"
    styles = getSampleStyleSheet()
    document = SimpleDocTemplate(str(pdf_path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    analysis = report["analysis"]
    rows = [["Report", "Dataset", "Type", "Status", "Created"], [report["name"], report["dataset_name"], report["type"], report["status"], report["created_at"][:10]]]
    metric_rows = [["Metric", "Value", "Change"]]
    metric_rows.extend([[metric["label"], metric["value"], metric.get("change", "-")] for metric in analysis["metrics"]])
    story = [Paragraph("DataMind AI Report", styles["Title"]), Paragraph(report["summary"], styles["BodyText"]), Spacer(1, 10), Table(rows), Spacer(1, 14), Paragraph("Computed metrics", styles["Heading2"]), Table(metric_rows)]
    for table in story[3], story[6]:
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#316653")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9e3dd")), ("PADDING", (0, 0), (-1, -1), 7)]))
    document.build(story)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{report['name'].replace(' ', '_')}.pdf")


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: str) -> dict[str, bool]:
    items = database_reports()
    remaining = [item for item in items if item["id"] != report_id]
    if len(remaining) == len(items):
        raise HTTPException(404, "Report not found.")
    if database_ready():
        with database_engine.begin() as connection:
            connection.execute(reports_table.delete().where(reports_table.c.id == report_id))
    else:
        save_reports(remaining)
    return {"deleted": True}
