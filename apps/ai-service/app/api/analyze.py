"""POST /v1/analyze — internal AI analysis endpoint."""

import time

import structlog
from fastapi import APIRouter

from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import analyze_records
from app.services.confidence_service import MODEL_VERSION, compute_confidence_context

log = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    started = time.monotonic_ns()

    # Never log patient identifiers or clinical values — only the request_id and record count
    log.info(
        "analyze_request_received",
        request_id=request.request_id,
        report_type=request.report_type,
        record_count=len(request.records),
    )

    summary, findings = analyze_records(request)
    confidence_context = compute_confidence_context(
        request.records, request.period_start, request.period_end
    )

    elapsed_ms = int((time.monotonic_ns() - started) / 1_000_000)

    log.info(
        "analyze_request_completed",
        request_id=request.request_id,
        findings_count=len(findings),
        processing_time_ms=elapsed_ms,
    )

    return AnalyzeResponse(
        request_id=request.request_id,
        model_version=MODEL_VERSION,
        summary_text=summary,
        pattern_findings=findings,
        confidence_context=confidence_context,
        processing_time_ms=elapsed_ms,
    )
