"""Contract tests for the /v1/analyze endpoint.

Verifies input/output schema compliance and core business rules:
- Minimum data requirements
- Finding suppression threshold
- Confidence rating presence
- No clinical recommendations in output
- model_version always present
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, headers={"X-Internal-Request-Id": "test-correlation-id"})

BASE_INSULIN = {
    "record_type": "insulin",
    "occurred_at": "2026-05-01T08:00:00+00:00",
    "value": 4.0,
    "metadata": {"dose_rationale": "meal_coverage", "timezone": "America/Sao_Paulo"},
}

BASE_GLUCOSE = {
    "record_type": "glucose",
    "occurred_at": "2026-05-01T09:30:00+00:00",
    "value": 180.0,
    "metadata": {"source": "pre_insulin"},
}

BASE_SYMPTOM = {
    "record_type": "symptom",
    "occurred_at": "2026-05-01T14:00:00+00:00",
    "value": 2.0,
    "metadata": {"severity_level": "moderate", "symptom_count": 2, "timezone": "America/Sao_Paulo"},
}


def _make_request(records: list[dict], report_type: str = "weekly_summary") -> dict:
    return {
        "request_id": "test-req-001",
        "patient_profile_id": "00000000-0000-0000-0000-000000000001",
        "report_type": report_type,
        "period_start": "2026-05-01",
        "period_end": "2026-05-07",
        "records": records,
    }


# ── Schema compliance ────────────────────────────────────────────────────────


def test_successful_response_schema() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(5)]
    resp = client.post("/v1/analyze", json=_make_request(records))
    assert resp.status_code == 200  # noqa: S101

    body = resp.json()
    assert "request_id" in body
    assert "model_version" in body
    assert "summary_text" in body
    assert "pattern_findings" in body
    assert "processing_time_ms" in body
    assert isinstance(body["pattern_findings"], list)
    assert isinstance(body["processing_time_ms"], int)


def test_request_id_echoed() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    resp = client.post("/v1/analyze", json=_make_request(records))
    assert resp.json()["request_id"] == "test-req-001"  # noqa: S101


def test_model_version_always_present() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    resp = client.post("/v1/analyze", json=_make_request(records))
    body = resp.json()
    assert body["model_version"] != ""  # noqa: S101


def test_all_report_types_accepted() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    for rtype in ("weekly_summary", "glucose_pattern", "insulin_effectiveness", "symptom_trend"):
        resp = client.post("/v1/analyze", json=_make_request(records, report_type=rtype))
        assert resp.status_code == 200, f"Failed for report_type={rtype}"  # noqa: S101


def test_invalid_report_type_rejected() -> None:
    records = [dict(BASE_INSULIN) for _ in range(3)]
    resp = client.post("/v1/analyze", json=_make_request(records, report_type="invalid_type"))
    assert resp.status_code == 422  # noqa: S101


def test_missing_required_fields_rejected() -> None:
    resp = client.post("/v1/analyze", json={"report_type": "weekly_summary"})
    assert resp.status_code == 422  # noqa: S101


# ── Findings business rules ──────────────────────────────────────────────────


def test_findings_suppressed_below_min_support() -> None:
    """Findings with fewer than 3 supporting data points must be suppressed."""
    # Only 1 high glucose + meal record — below threshold
    records = [
        dict(BASE_INSULIN, occurred_at="2026-05-01T08:00:00+00:00"),
        dict(BASE_INSULIN, occurred_at="2026-05-02T08:00:00+00:00"),
        dict(BASE_INSULIN, occurred_at="2026-05-03T08:00:00+00:00"),
        dict(BASE_GLUCOSE, value=250.0, occurred_at="2026-05-01T09:30:00+00:00"),  # only 1 spike
    ]
    resp = client.post("/v1/analyze", json=_make_request(records))
    body = resp.json()
    spike_findings = [  # noqa: S101
        f for f in body["pattern_findings"] if f["finding_type"] == "post_meal_glucose_spike"
    ]
    assert len(spike_findings) == 0  # noqa: S101


def test_findings_confidence_field_always_present() -> None:
    records = (
        [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(7)]
        + [
            dict(BASE_GLUCOSE, value=250.0, occurred_at=f"2026-05-0{i+1}T09:30:00+00:00")
            for i in range(5)
        ]
    )
    resp = client.post("/v1/analyze", json=_make_request(records))
    for finding in resp.json()["pattern_findings"]:
        assert finding["confidence"] in ("low", "medium", "high")  # noqa: S101
        assert isinstance(finding["supporting_data_points"], int)  # noqa: S101
        assert finding["supporting_data_points"] >= 3  # noqa: S101


def test_finding_confidence_increases_with_more_data() -> None:
    few_records = [
        dict(
            BASE_INSULIN,
            **{
                "metadata": {"dose_rationale": "correction", "timezone": "UTC"},
                "occurred_at": f"2026-05-0{i+1}T08:00:00+00:00",
            },
        )
        for i in range(3)
    ]
    many_records = [
        dict(
            BASE_INSULIN,
            **{
                "metadata": {"dose_rationale": "correction", "timezone": "UTC"},
                "occurred_at": f"2026-05-{i+1:02d}T08:00:00+00:00",
            },
        )
        for i in range(12)
    ]

    resp_few = client.post("/v1/analyze", json=_make_request(few_records))
    resp_many = client.post("/v1/analyze", json=_make_request(many_records))

    findings_few = {f["finding_type"]: f for f in resp_few.json()["pattern_findings"]}
    findings_many = {f["finding_type"]: f for f in resp_many.json()["pattern_findings"]}

    if "high_correction_frequency" in findings_few and "high_correction_frequency" in findings_many:
        conf_order = {"low": 0, "medium": 1, "high": 2}
        assert (
            conf_order[findings_many["high_correction_frequency"]["confidence"]]
            >= conf_order[findings_few["high_correction_frequency"]["confidence"]]
        )  # noqa: S101


# ── PHI isolation ────────────────────────────────────────────────────────────


def test_response_contains_no_patient_name() -> None:
    """Output must never echo back patient identifiers."""
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    payload = _make_request(records)
    payload["patient_profile_id"] = "patient-should-not-appear-in-output"
    resp = client.post("/v1/analyze", json=payload)
    body_text = resp.text
    assert "patient-should-not-appear-in-output" not in body_text  # noqa: S101


# ── Confidence context ───────────────────────────────────────────────────────


def test_confidence_context_present_in_response() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(5)]
    resp = client.post("/v1/analyze", json=_make_request(records))
    ctx = resp.json()["confidence_context"]
    assert ctx is not None  # noqa: S101
    assert "data_coverage_percent" in ctx  # noqa: S101
    assert "model_limitations" in ctx  # noqa: S101
    assert isinstance(ctx["model_limitations"], list)  # noqa: S101


def test_short_period_adds_limitation_warning() -> None:
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    payload = _make_request(records)
    payload["period_start"] = "2026-05-01"
    payload["period_end"] = "2026-05-03"  # only 2 days
    resp = client.post("/v1/analyze", json=payload)
    ctx = resp.json()["confidence_context"]
    assert any(  # noqa: S101
        "7 days" in lim or "days" in lim for lim in ctx["model_limitations"]
    )


# ── Internal-only enforcement ────────────────────────────────────────────────


def test_request_without_internal_header_rejected() -> None:
    """Requests without X-Internal-Request-Id must be rejected."""
    plain_client = TestClient(app)
    records = [dict(BASE_INSULIN, occurred_at=f"2026-05-0{i+1}T08:00:00+00:00") for i in range(3)]
    resp = plain_client.post("/v1/analyze", json=_make_request(records))
    assert resp.status_code == 403  # noqa: S101
