"""Pydantic schemas for the /v1/analyze endpoint."""

from typing import Literal

from pydantic import BaseModel, Field


class AggregatedRecord(BaseModel):
    record_type: Literal["insulin", "symptom", "glucose"]
    occurred_at: str
    value: float
    metadata: dict[str, str | int | float] = Field(default_factory=dict)


class AnalyzeRequest(BaseModel):
    request_id: str
    patient_profile_id: str
    report_type: Literal[
        "weekly_summary",
        "glucose_pattern",
        "insulin_effectiveness",
        "symptom_trend",
    ]
    period_start: str
    period_end: str
    records: list[AggregatedRecord]


class PatternFinding(BaseModel):
    finding_type: str
    description: str
    supporting_data_points: int
    confidence: Literal["low", "medium", "high"]


class ConfidenceContext(BaseModel):
    data_coverage_percent: float
    model_limitations: list[str]


class AnalyzeResponse(BaseModel):
    request_id: str
    model_version: str
    summary_text: str
    pattern_findings: list[PatternFinding]
    confidence_context: ConfidenceContext | None
    processing_time_ms: int
