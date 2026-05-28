"""Computes confidence ratings for pattern findings and overall report confidence context."""

from datetime import datetime, timezone
from typing import Literal

from app.schemas.analyze import AggregatedRecord, ConfidenceContext

MODEL_VERSION = "sweetcare-stats-v1.0"


def compute_finding_confidence(data_points: int) -> Literal["low", "medium", "high"]:
    if data_points >= 10:
        return "high"
    if data_points >= 5:
        return "medium"
    return "low"


def compute_confidence_context(
    records: list[AggregatedRecord],
    period_start: str,
    period_end: str,
) -> ConfidenceContext:
    limitations: list[str] = []

    start = datetime.fromisoformat(period_start)
    end = datetime.fromisoformat(period_end)
    period_days = max((end - start).days, 1)

    insulin_records = [r for r in records if r.record_type == "insulin"]
    glucose_records = [r for r in records if r.record_type == "glucose"]

    # Coverage: days that have at least one insulin record
    days_with_data: set[str] = set()
    for r in insulin_records:
        try:
            day = datetime.fromisoformat(r.occurred_at).strftime("%Y-%m-%d")
            days_with_data.add(day)
        except ValueError:
            pass

    coverage_percent = round(len(days_with_data) / period_days * 100, 1)

    if period_days < 7:
        limitations.append(
            "Fewer than 7 days of data — patterns may be incomplete"
        )
    if coverage_percent < 70:
        limitations.append(
            f"Data available for only {coverage_percent:.0f}% of the period — gaps may affect accuracy"
        )
    if len(glucose_records) < 5:
        limitations.append(
            "Limited glucose readings — glucose pattern analysis has reduced accuracy"
        )
    if len(insulin_records) < 14:
        limitations.append(
            "Fewer than 14 insulin records — statistical patterns may not be reliable"
        )

    return ConfidenceContext(
        data_coverage_percent=coverage_percent,
        model_limitations=limitations,
    )
