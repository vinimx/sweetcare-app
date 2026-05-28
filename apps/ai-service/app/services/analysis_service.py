"""Statistical analysis of aggregated T1DM records.

Produces pattern findings without referencing patient identifiers or raw PHI.
All findings with fewer than 3 supporting data points are suppressed per contract.
No finding may imply diagnosis, treatment recommendation, or clinical instruction.
"""

from collections import defaultdict
from datetime import datetime

from app.schemas.analyze import AggregatedRecord, AnalyzeRequest, PatternFinding
from app.services.confidence_service import compute_finding_confidence

_MIN_SUPPORT = 3  # suppress findings with fewer data points


def _parse_dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _hour_of_day(iso: str) -> int:
    return _parse_dt(iso).hour


# ── Individual pattern detectors ────────────────────────────────────────────


def _detect_post_meal_glucose_spike(
    insulin_records: list[AggregatedRecord],
    glucose_records: list[AggregatedRecord],
) -> PatternFinding | None:
    """Flags cases where a glucose reading > 200 mg/dL follows a meal_coverage dose."""
    meal_times = [
        _parse_dt(r.occurred_at)
        for r in insulin_records
        if r.metadata.get("dose_rationale") == "meal_coverage"
    ]
    if len(meal_times) < _MIN_SUPPORT:
        return None

    high_post_meal = 0
    for g in glucose_records:
        g_time = _parse_dt(g.occurred_at)
        if g.value > 200:
            for m in meal_times:
                delta_minutes = (g_time - m).total_seconds() / 60
                if 0 <= delta_minutes <= 120:
                    high_post_meal += 1
                    break

    if high_post_meal < _MIN_SUPPORT:
        return None

    return PatternFinding(
        finding_type="post_meal_glucose_spike",
        description=(
            f"High glucose readings (>200 mg/dL) were observed after {high_post_meal} "
            "meal doses within a 2-hour window."
        ),
        supporting_data_points=high_post_meal,
        confidence=compute_finding_confidence(high_post_meal),
    )


def _detect_nocturnal_hypoglycemia_risk(
    glucose_records: list[AggregatedRecord],
) -> PatternFinding | None:
    """Flags low glucose readings (< 70 mg/dL) recorded between 22:00 and 06:00."""
    nocturnal_low = [
        g for g in glucose_records
        if g.value < 70 and (_hour_of_day(g.occurred_at) >= 22 or _hour_of_day(g.occurred_at) < 6)
    ]
    if len(nocturnal_low) < _MIN_SUPPORT:
        return None

    return PatternFinding(
        finding_type="nocturnal_hypoglycemia_risk",
        description=(
            f"Low glucose readings (<70 mg/dL) were recorded {len(nocturnal_low)} times "
            "during nighttime hours (22:00–06:00)."
        ),
        supporting_data_points=len(nocturnal_low),
        confidence=compute_finding_confidence(len(nocturnal_low)),
    )


def _detect_high_correction_frequency(
    insulin_records: list[AggregatedRecord],
) -> PatternFinding | None:
    """Flags periods with elevated correction dose frequency (> 2 corrections per day)."""
    days_with_corrections: dict[str, int] = defaultdict(int)
    for r in insulin_records:
        if r.metadata.get("dose_rationale") == "correction":
            day = _parse_dt(r.occurred_at).strftime("%Y-%m-%d")
            days_with_corrections[day] += 1

    high_correction_days = [d for d, count in days_with_corrections.items() if count > 2]
    if len(high_correction_days) < _MIN_SUPPORT:
        return None

    return PatternFinding(
        finding_type="high_correction_frequency",
        description=(
            f"More than 2 correction doses were recorded on {len(high_correction_days)} days, "
            "which may indicate glucose variability."
        ),
        supporting_data_points=len(high_correction_days),
        confidence=compute_finding_confidence(len(high_correction_days)),
    )


def _detect_symptom_severity_pattern(
    symptom_records: list[AggregatedRecord],
) -> PatternFinding | None:
    """Flags recurrent moderate-or-higher severity symptom episodes."""
    significant = [s for s in symptom_records if s.value >= 2]  # moderate=2, severe=3, emergency=4
    if len(significant) < _MIN_SUPPORT:
        return None

    return PatternFinding(
        finding_type="recurrent_moderate_symptoms",
        description=(
            f"Moderate or higher severity symptoms were recorded {len(significant)} times "
            "in the selected period."
        ),
        supporting_data_points=len(significant),
        confidence=compute_finding_confidence(len(significant)),
    )


def _detect_glucose_variability(
    glucose_records: list[AggregatedRecord],
) -> PatternFinding | None:
    """Reports high glucose variability when the range exceeds 250 mg/dL across the period."""
    if len(glucose_records) < _MIN_SUPPORT:
        return None

    values = [g.value for g in glucose_records]
    glucose_range = max(values) - min(values)
    if glucose_range < 250:
        return None

    return PatternFinding(
        finding_type="high_glucose_variability",
        description=(
            f"Glucose readings ranged from {min(values):.0f} to {max(values):.0f} mg/dL "
            f"(range {glucose_range:.0f} mg/dL) during the period."
        ),
        supporting_data_points=len(glucose_records),
        confidence=compute_finding_confidence(len(glucose_records)),
    )


# ── Summary generators ───────────────────────────────────────────────────────


def _build_summary(
    request: AnalyzeRequest,
    findings: list[PatternFinding],
    insulin_count: int,
    glucose_count: int,
    symptom_count: int,
) -> str:
    base = (
        f"Análise do período de {request.period_start} a {request.period_end}: "
        f"{insulin_count} registros de insulina, {glucose_count} leituras de glicemia e "
        f"{symptom_count} registros de sintomas foram analisados."
    )
    if not findings:
        return base + " Nenhum padrão estatisticamente significativo foi identificado no período."

    finding_labels = {
        "post_meal_glucose_spike": "elevação glicêmica pós-refeição",
        "nocturnal_hypoglycemia_risk": "risco de hipoglicemia noturna",
        "high_correction_frequency": "alta frequência de doses de correção",
        "recurrent_moderate_symptoms": "sintomas moderados recorrentes",
        "high_glucose_variability": "alta variabilidade glicêmica",
    }
    labels = [finding_labels.get(f.finding_type, f.finding_type) for f in findings]
    return (
        base
        + f" {len(findings)} padrão(ões) identificado(s): "
        + ", ".join(labels)
        + "."
    )


# ── Public API ───────────────────────────────────────────────────────────────


def analyze_records(request: AnalyzeRequest) -> tuple[str, list[PatternFinding]]:
    """Returns (summary_text, pattern_findings) for the given aggregated records."""
    insulin = [r for r in request.records if r.record_type == "insulin"]
    glucose = [r for r in request.records if r.record_type == "glucose"]
    symptoms = [r for r in request.records if r.record_type == "symptom"]

    detectors = [
        _detect_post_meal_glucose_spike(insulin, glucose),
        _detect_nocturnal_hypoglycemia_risk(glucose),
        _detect_high_correction_frequency(insulin),
        _detect_symptom_severity_pattern(symptoms),
        _detect_glucose_variability(glucose),
    ]

    findings = [f for f in detectors if f is not None]
    summary = _build_summary(request, findings, len(insulin), len(glucose), len(symptoms))

    return summary, findings
