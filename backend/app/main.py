from __future__ import annotations

import math
import os
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="FluxIQ Flood Intelligence API", version="2.0.0")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

class FloodInput(BaseModel):
    rainfall_3h_mm: float = Field(ge=0, le=500)
    rainfall_24h_mm: float = Field(ge=0, le=1000)
    water_level_m: float | None = Field(default=None, ge=0, le=50)
    drainage_factor: float = Field(default=0.65, ge=0, le=1)
    impervious_factor: float = Field(default=0.70, ge=0, le=1)

class FloodResponse(BaseModel):
    score: int
    level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    label: str
    lead_time_minutes: int
    water_level_m: float
    water_level_source: str
    recommended_actions: list[str]


def analyze_flood(x: FloodInput) -> FloodResponse:
    # Transparent demonstration model. It is intentionally not represented as a validated
    # hydrodynamic model; official gauge/inundation data should replace the derived level.
    rain_signal = min(100, x.rainfall_3h_mm * 1.35 + x.rainfall_24h_mm * 0.30)
    urban_factor = 0.75 + 0.45 * x.drainage_factor + 0.25 * x.impervious_factor
    gauge_signal = 0 if x.water_level_m is None else min(35, max(0, x.water_level_m - 2.0) * 18)
    score = min(99, round(rain_signal * urban_factor + gauge_signal))
    if score >= 78:
        level, label, lead, actions = "CRITICAL", "Inundation conditions likely", 30, ["Issue public warning", "Close exposed underpasses", "Dispatch response and pumping teams"]
    elif score >= 58:
        level, label, lead, actions = "HIGH", "Flood risk rising rapidly", 60, ["Put response teams on standby", "Inspect drainage choke points", "Prepare public advisory"]
    elif score >= 38:
        level, label, lead, actions = "MODERATE", "Drainage stress possible", 90, ["Increase monitoring", "Stage drainage crews", "Review vulnerable roads"]
    else:
        level, label, lead, actions = "LOW", "No immediate flood signal", 120, ["Continue monitoring", "Keep routine drainage watch", "No public warning indicated"]
    derived_level = x.water_level_m if x.water_level_m is not None else max(1.8, 2.15 + x.rainfall_3h_mm * .035 + x.rainfall_24h_mm * .004)
    return FloodResponse(score=score, level=level, label=label, lead_time_minutes=lead, water_level_m=round(derived_level, 2), water_level_source="official gauge" if x.water_level_m is not None else "rainfall-derived model estimate", recommended_actions=actions)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "fluxiq-flood-api", "version": "2.0.0"}

@app.get("/api/flood/demo", response_model=FloodResponse)
def demo_flood() -> FloodResponse:
    return analyze_flood(FloodInput(rainfall_3h_mm=25.0, rainfall_24h_mm=78.0))

@app.post("/api/flood/analyze", response_model=FloodResponse)
def flood_analyze(request: FloodInput) -> FloodResponse:
    return analyze_flood(request)

@app.get("/api/flood/model-info")
def model_info() -> dict:
    return {"name": "FluxIQ rainfall-driven urban flood risk model", "type": "transparent prototype", "inputs": ["rainfall_3h_mm", "rainfall_24h_mm", "water_level_m", "drainage_factor", "impervious_factor"], "outputs": ["risk score", "risk band", "lead time", "response actions"], "limitation": "Not a validated hydrodynamic or official warning model."}
