import { logger } from "../logging/logger.js";
import type { AggregatedRecord } from "../../application/services/insight-aggregation.service.js";

export interface AiAnalyzeRequest {
  request_id: string;
  patient_profile_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  records: AggregatedRecord[];
}

export interface AiPatternFinding {
  finding_type: string;
  description: string;
  supporting_data_points: number;
  confidence: "low" | "medium" | "high";
}

export interface AiConfidenceContext {
  data_coverage_percent: number;
  model_limitations: string[];
}

export interface AiAnalyzeResponse {
  request_id: string;
  model_version: string;
  summary_text: string;
  pattern_findings: AiPatternFinding[];
  confidence_context: AiConfidenceContext | null;
  processing_time_ms: number;
}

// ── Circuit breaker ──────────────────────────────────────────────────────────
// Opens after 3 consecutive failures; recovers after 30 s probe window.
type CircuitState = "closed" | "open" | "half-open";

const circuit = {
  state: "closed" as CircuitState,
  failures: 0,
  lastFailure: 0,
  FAILURE_THRESHOLD: 3,
  RECOVERY_TIMEOUT_MS: 30_000,
};

function circuitIsOpen(): boolean {
  if (circuit.state === "open") {
    const elapsed = Date.now() - circuit.lastFailure;
    if (elapsed >= circuit.RECOVERY_TIMEOUT_MS) {
      circuit.state = "half-open";
      return false;
    }
    return true;
  }
  return false;
}

function onSuccess() {
  circuit.failures = 0;
  circuit.state = "closed";
}

function onFailure() {
  circuit.failures += 1;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= circuit.FAILURE_THRESHOLD) {
    circuit.state = "open";
    logger.error({ failures: circuit.failures }, "AI service circuit breaker opened");
  }
}

function makeUnavailableError(): Error & { code: string; statusCode: number } {
  const err = new Error("INSIGHTS_SERVICE_UNAVAILABLE") as Error & {
    code: string;
    statusCode: number;
  };
  err.code = "INSIGHTS_SERVICE_UNAVAILABLE";
  err.statusCode = 503;
  return err;
}

// ── Client ───────────────────────────────────────────────────────────────────

const AI_TIMEOUT_MS = 30_000;

export async function callAnalyze(payload: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
  if (circuitIsOpen()) {
    throw makeUnavailableError();
  }

  const baseUrl = process.env["AI_SERVICE_URL"] ?? "http://localhost:8000";
  const url = `${baseUrl}/v1/analyze`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Request-Id": payload.request_id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn(
        { status: response.status, body: text, requestId: payload.request_id },
        "AI service returned error",
      );
      onFailure();

      if (response.status === 422) {
        const err = new Error("INSUFFICIENT_DATA") as Error & { code: string; statusCode: number };
        err.code = "INSUFFICIENT_DATA";
        err.statusCode = 422;
        throw err;
      }
      throw makeUnavailableError();
    }

    const data = (await response.json()) as AiAnalyzeResponse;
    onSuccess();
    return data;
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      logger.warn({ requestId: payload.request_id }, "AI service request timed out");
      onFailure();
      const timeoutErr = new Error("TIMEOUT") as Error & { code: string; statusCode: number };
      timeoutErr.code = "TIMEOUT";
      timeoutErr.statusCode = 503;
      throw timeoutErr;
    }
    // Re-throw typed errors (INSUFFICIENT_DATA, INSIGHTS_SERVICE_UNAVAILABLE, TIMEOUT)
    if (err instanceof Error && "code" in err) throw err;

    logger.warn({ err, requestId: payload.request_id }, "AI service request failed");
    onFailure();
    throw makeUnavailableError();
  }
}
