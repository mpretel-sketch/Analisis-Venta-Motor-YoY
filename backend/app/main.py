from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import logging
import math
import json

# Cargar variables de entorno desde .env
load_dotenv()

logger = logging.getLogger("early_warning")


def _sanitize_json(value):
    if isinstance(value, dict):
        return {k: _sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    return value

from .analysis import AnalysisError, analyze_yoy, build_excel_report_bytes, build_excel_report_bytes_multi, build_pdf_report_bytes
from .netsuite_client import get_netsuite_client, NetSuiteError, dataframe_to_excel_format

app = FastAPI(title="Early Warning YoY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    alert_threshold: Optional[float] = Form(-30.0),
    mode: Optional[str] = Form("month"),
    month_key: Optional[str] = Form(None),
    compare_mode: Optional[str] = Form(None),
    compare_month_key: Optional[str] = Form(None),
    search: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    impact_min: Optional[float] = Form(None),
    impact_max: Optional[float] = Form(None),
    var_min: Optional[float] = Form(None),
    var_max: Optional[float] = Form(None),
    persist_threshold: Optional[float] = Form(None),
    recovery_threshold: Optional[float] = Form(None),
    churn_months: Optional[int] = Form(9),
):
    try:
        file_bytes = await file.read()
        result = analyze_yoy(
            file_bytes,
            file.filename,
            alert_threshold=alert_threshold or -30.0,
            mode=(mode or "month"),
            month_key=month_key,
            search=search,
            location=location,
            impact_min=impact_min,
            impact_max=impact_max,
            var_min=var_min,
            var_max=var_max,
            persist_threshold=persist_threshold,
            recovery_threshold=recovery_threshold,
            churn_months=churn_months or 9,
        )
        if compare_mode:
            compare = analyze_yoy(
                file_bytes,
                file.filename,
                alert_threshold=alert_threshold or -30.0,
                mode=compare_mode,
                month_key=compare_month_key,
                search=search,
                location=location,
                impact_min=impact_min,
                impact_max=impact_max,
                var_min=var_min,
                var_max=var_max,
                persist_threshold=persist_threshold,
                recovery_threshold=recovery_threshold,
                churn_months=churn_months or 9,
            )
            result["compare"] = compare
        return JSONResponse(content=_sanitize_json(result))
    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error inesperado en /api/analyze")
        raise HTTPException(status_code=500, detail=f"Error inesperado: {exc}") from exc


@app.post("/api/report/excel")
async def report_excel(
    file: UploadFile = File(...),
    alert_threshold: Optional[float] = Form(-30.0),
    mode: Optional[str] = Form("month"),
    month_key: Optional[str] = Form(None),
    export_modes: Optional[str] = Form(None),
    search: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    impact_min: Optional[float] = Form(None),
    impact_max: Optional[float] = Form(None),
    var_min: Optional[float] = Form(None),
    var_max: Optional[float] = Form(None),
):
    try:
        file_bytes = await file.read()
        if export_modes:
            requests = json.loads(export_modes)
            content = build_excel_report_bytes_multi(
                file_bytes,
                file.filename,
                requests,
                search=search,
                location=location,
                impact_min=impact_min,
                impact_max=impact_max,
                var_min=var_min,
                var_max=var_max,
            )
        else:
            content, _ = build_excel_report_bytes(
                file_bytes,
                file.filename,
                mode=(mode or "month"),
                month_key=month_key,
                search=search,
                location=location,
                impact_min=impact_min,
                impact_max=impact_max,
                var_min=var_min,
                var_max=var_max,
            )
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Early_Warning_YoY.xlsx"},
        )
    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error inesperado en /api/report/excel")
        raise HTTPException(status_code=500, detail=f"Error inesperado: {exc}") from exc




@app.post("/api/report/pdf")
async def report_pdf(
    file: UploadFile = File(...),
    alert_threshold: Optional[float] = Form(-30.0),
    mode: Optional[str] = Form("month"),
    month_key: Optional[str] = Form(None),
    search: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    impact_min: Optional[float] = Form(None),
    impact_max: Optional[float] = Form(None),
    var_min: Optional[float] = Form(None),
    var_max: Optional[float] = Form(None),
    persist_threshold: Optional[float] = Form(None),
    recovery_threshold: Optional[float] = Form(None),
    churn_months: Optional[int] = Form(9),
):
    try:
        file_bytes = await file.read()
        result = analyze_yoy(
            file_bytes,
            file.filename,
            alert_threshold=alert_threshold or -30.0,
            mode=(mode or "month"),
            month_key=month_key,
            search=search,
            location=location,
            impact_min=impact_min,
            impact_max=impact_max,
            var_min=var_min,
            var_max=var_max,
            persist_threshold=persist_threshold,
            recovery_threshold=recovery_threshold,
            churn_months=churn_months or 9,
        )
        content = build_pdf_report_bytes(result)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=Executive_YoY_Report.pdf"},
        )
    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error inesperado en /api/report/pdf")
        raise HTTPException(status_code=500, detail=f"Error inesperado: {exc}") from exc
@app.post("/api/analyze/netsuite")
async def analyze_netsuite(
    alert_threshold: Optional[float] = Form(-30.0),
    mode: Optional[str] = Form("month"),
    month_key: Optional[str] = Form(None),
    compare_mode: Optional[str] = Form(None),
    compare_month_key: Optional[str] = Form(None),
    search: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    impact_min: Optional[float] = Form(None),
    impact_max: Optional[float] = Form(None),
    var_min: Optional[float] = Form(None),
    var_max: Optional[float] = Form(None),
    persist_threshold: Optional[float] = Form(None),
    recovery_threshold: Optional[float] = Form(None),
    churn_months: Optional[int] = Form(9),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
):
    """
    Analiza datos de ventas obtenidos directamente desde NetSuite via RESTlet.

    Parámetros adicionales:
    - start_date: Fecha inicio para filtrar datos en NetSuite (formato YYYY-MM-DD)
    - end_date: Fecha fin para filtrar datos en NetSuite (formato YYYY-MM-DD)

    Los demás parámetros son los mismos que /api/analyze.
    """
    try:
        # Obtener cliente de NetSuite
        try:
            ns_client = get_netsuite_client()
        except ValueError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Configuración de NetSuite incompleta: {exc}"
            ) from exc

        # Obtener datos desde NetSuite
        try:
            df = ns_client.fetch_sales_data(
                start_date=start_date,
                end_date=end_date,
            )

            if df.empty:
                raise HTTPException(
                    status_code=404,
                    detail="NetSuite no devolvió datos. Verifica los filtros o el RESTlet."
                )

            # Convertir DataFrame a bytes de Excel para reutilizar analyze_yoy
            file_bytes = dataframe_to_excel_format(df)

        except NetSuiteError as exc:
            logger.error(f"Error al consultar NetSuite: {exc}")
            raise HTTPException(
                status_code=502,
                detail=f"Error al conectar con NetSuite: {exc}"
            ) from exc

        # Usar la misma lógica de análisis que el endpoint original
        result = analyze_yoy(
            file_bytes,
            "netsuite_data.xlsx",  # Nombre ficticio
            alert_threshold=alert_threshold or -30.0,
            mode=(mode or "month"),
            month_key=month_key,
            search=search,
            location=location,
            impact_min=impact_min,
            impact_max=impact_max,
            var_min=var_min,
            var_max=var_max,
            persist_threshold=persist_threshold,
            recovery_threshold=recovery_threshold,
            churn_months=churn_months or 9,
        )

        # Si hay modo de comparación, ejecutarlo
        if compare_mode:
            compare = analyze_yoy(
                file_bytes,
                "netsuite_data.xlsx",
                alert_threshold=alert_threshold or -30.0,
                mode=compare_mode,
                month_key=compare_month_key,
                search=search,
                location=location,
                impact_min=impact_min,
                impact_max=impact_max,
                var_min=var_min,
                var_max=var_max,
                persist_threshold=persist_threshold,
                recovery_threshold=recovery_threshold,
            )
            result["compare"] = compare

        return JSONResponse(content=_sanitize_json(result))

    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error inesperado en /api/analyze/netsuite")
        raise HTTPException(status_code=500, detail=f"Error inesperado: {exc}") from exc


@app.get("/api/netsuite/test")
async def test_netsuite():
    """
    Endpoint para probar la conexión con NetSuite.
    """
    try:
        ns_client = get_netsuite_client()
        result = ns_client.test_connection()
        if result["success"]:
            return JSONResponse(content=result)
        else:
            raise HTTPException(status_code=502, detail=result["message"])
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Configuración de NetSuite incompleta: {exc}"
        ) from exc
    except Exception as exc:
        logger.exception("Error al probar conexión con NetSuite")
        raise HTTPException(status_code=500, detail=f"Error: {exc}") from exc
