from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
METADATA_FILE = DATA_DIR / "datasets.json"
REPORTS_FILE = DATA_DIR / "reports.json"
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_TYPES = {".csv", ".xlsx", ".xls"}

app = FastAPI(title="DataMind AI API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


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


def load_frame(dataset: dict[str, Any]) -> pd.DataFrame:
    path = Path(dataset["path"])
    if dataset["file_type"] == "csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


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
    return {"dataset": {key: value for key, value in dataset.items() if key != "path"}, "metrics": metrics, "charts": charts, "insights": insights, "profile": profile, "quality": quality}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/datasets")
def datasets() -> list[dict[str, Any]]:
    return [{key: value for key, value in item.items() if key != "path"} for item in read_metadata()]


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
    items = read_metadata(); items.insert(0, item); save_metadata(items)
    return {key: value for key, value in item.items() if key != "path"}


@app.post("/api/datasets/demo")
def demo_dataset() -> dict[str, Any]:
    frame = pd.DataFrame({"Month": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], "Region": ["North", "South", "North", "West", "South", "West"], "Revenue": [120000, 135000, 112000, 158000, 149000, 175000], "Orders": [420, 460, 390, 540, 515, 590], "Marketing Spend": [18000, 21000, 19500, 24000, 23000, 26000]})
    dataset_id = str(uuid.uuid4()); path = DATA_DIR / f"{dataset_id}.csv"; frame.to_csv(path, index=False)
    item = {"id": dataset_id, "name": "demo_sales.csv", "rows": len(frame), "columns": len(frame.columns), "quality_score": quality_frame(frame)["score"], "status": "ready", "file_type": "csv", "created_at": datetime.now(timezone.utc).isoformat(), "size_bytes": path.stat().st_size, "path": str(path)}
    items = read_metadata(); items.insert(0, item); save_metadata(items)
    return {key: value for key, value in item.items() if key != "path"}


@app.get("/api/datasets/{dataset_id}/analysis")
def dataset_analysis(dataset_id: str) -> dict[str, Any]:
    dataset = next((item for item in read_metadata() if item["id"] == dataset_id), None)
    if not dataset:
        raise HTTPException(404, "Dataset not found.")
    return analysis_for(dataset)


class ChatRequest(BaseModel):
    dataset_id: str
    question: str


@app.post("/api/ai/chat")
def chat(request: ChatRequest) -> dict[str, str]:
    dataset = next((item for item in read_metadata() if item["id"] == request.dataset_id), None)
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
    return read_reports()


@app.post("/api/reports")
def create_report(request: ReportRequest) -> dict[str, Any]:
    dataset = next((item for item in read_metadata() if item["id"] == request.dataset_id), None)
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
    items = read_reports()
    items.insert(0, report)
    save_reports(items)
    return report


@app.get("/api/reports/{report_id}")
def get_report(report_id: str) -> dict[str, Any]:
    report = next((item for item in read_reports() if item["id"] == report_id), None)
    if not report:
        raise HTTPException(404, "Report not found.")
    return report


@app.get("/api/reports/{report_id}/pdf")
def download_report_pdf(report_id: str) -> FileResponse:
    report = next((item for item in read_reports() if item["id"] == report_id), None)
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
    items = read_reports()
    remaining = [item for item in items if item["id"] != report_id]
    if len(remaining) == len(items):
        raise HTTPException(404, "Report not found.")
    save_reports(remaining)
    return {"deleted": True}
