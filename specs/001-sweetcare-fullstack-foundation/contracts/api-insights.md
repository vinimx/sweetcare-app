# API Contract: AI-Assisted Insights & Reports

**Service**: `apps/api` (Fastify, proxy) → `apps/ai-service` (FastAPI, internal)  
**External base path**: `/v1/insights` (Fastify)  
**Internal base path**: `http://ai-service:8000/v1/` (not publicly exposed)  
**Version**: 1.0.0

> The AI service is strictly internal. All external requests flow through the Fastify API,  
> which enforces auth, consent verification, and PHI-safe logging before forwarding.  
> The AI service MUST never be directly reachable from the internet.

---

## External API (Fastify Proxy)

### POST /v1/insights/reports

Requests generation of an AI-assisted insight report. Requires active `ai_analysis` consent.

**Auth**: Bearer token, active CaregiverAssignment.

### Request

```typescript
{
  report_type:
    | "weekly_summary"
    | "glucose_pattern"
    | "insulin_effectiveness"
    | "symptom_trend";
  period_start: string;    // ISO 8601 date, inclusive
  period_end: string;      // ISO 8601 date, inclusive; max range = 90 days
}
```

**Validation rules**:

- `period_end` must be ≥ `period_start`.
- Maximum window: 90 calendar days.
- Minimum data requirement: ≥ 3 insulin records in the period (returns `INSUFFICIENT_DATA` otherwise).

### Response `202 Accepted`

Report generation is asynchronous.

```typescript
{
  report_id: string;
  status: "processing";
  estimated_ready_in_seconds: number; // advisory estimate, typically 5–30s
  poll_url: string; // absolute URL for GET poll
}
```

---

### GET /v1/insights/reports/{reportId}

Polls for report status or retrieves a completed report.

**Auth**: Bearer token, same user who requested or any authorized caregiver for the patient.

### Response `200 OK` (processing)

```typescript
{
  report_id: string;
  status: "processing";
  progress_percent: number | null; // optional; may be null if indeterminate
}
```

### Response `200 OK` (completed)

```typescript
{
  report_id: string;
  status: "completed";
  report_type: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  ai_model_version: string;
  is_invalidated: boolean; // true if source data was corrected post-generation
  content: ReportContent;
}

type ReportContent = {
  summary_text: string; // plain-language summary [PHI-ENCRYPTED in DB]
  pattern_findings: PatternFinding[];
  confidence_context: ConfidenceContext | null;
  disclaimer: string; // MUST display before content
};

type PatternFinding = {
  finding_type: string; // e.g., "post_meal_glucose_spike", "nocturnal_hypoglycemia_risk"
  description: string; // human-readable, no clinical recommendations
  supporting_data_points: number; // count of records that support this finding
  confidence: "low" | "medium" | "high";
};

type ConfidenceContext = {
  data_coverage_percent: number; // % of period with sufficient data
  model_limitations: string[]; // e.g., ["Fewer than 7 days of data — patterns may be incomplete"]
};
```

**Mandatory disclaimer text** (from `disclaimer_key`):

> "Este relatório é gerado por análise estatística e não substitui avaliação ou orientação de profissional de saúde habilitado. Decisões clínicas não devem ser baseadas exclusivamente neste conteúdo."

### Response `200 OK` (failed)

```typescript
{
  report_id: string;
  status: "failed";
  error_code: "INSUFFICIENT_DATA" | "AI_SERVICE_ERROR" | "TIMEOUT";
  retry_allowed: boolean;
}
```

### Error codes

| Code                           | HTTP | Condition                                                      |
| ------------------------------ | ---- | -------------------------------------------------------------- |
| `REPORT_NOT_FOUND`             | 404  |                                                                |
| `FORBIDDEN`                    | 403  | No active CaregiverAssignment or `ai_analysis` consent revoked |
| `CONSENT_REQUIRED`             | 403  | No active `ai_analysis` consent                                |
| `PERIOD_TOO_LONG`              | 422  | > 90 days                                                      |
| `INSIGHTS_SERVICE_UNAVAILABLE` | 503  | AI service unreachable — core flows unaffected                 |

---

### GET /v1/insights/reports

Lists available reports for a patient.

**Auth**: Bearer token, active CaregiverAssignment.

### Query parameters

| Param         | Default  | Notes          |
| ------------- | -------- | -------------- |
| `patient_id`  | Required |                |
| `report_type` | all      | Filter by type |
| `limit`       | 10       | Max 50         |
| `cursor`      | —        |                |

---

## Internal AI Service API (FastAPI — not publicly exposed)

The Fastify proxy strips auth headers and adds `X-Internal-Request-Id` before forwarding. The AI service trusts only requests from the internal network.

### POST /v1/analyze

**Called by**: Fastify proxy only.

### Request

```typescript
{
  request_id: string;              // correlation ID propagated from Fastify
  patient_profile_id: string;      // opaque UUID — AI service never receives patient name
  report_type: string;
  period_start: string;
  period_end: string;
  records: AggregatedRecord[];     // pre-aggregated by Fastify; no raw PHI
}

type AggregatedRecord = {
  record_type: "insulin" | "symptom" | "glucose";
  occurred_at: string;             // ISO 8601 UTC
  value: number;                   // dose_units / severity_numeric / glucose_mgdl
  metadata: Record<string, string | number>;  // non-identifying clinical context
};
```

**PHI Isolation**: The Fastify proxy aggregates and strips all identifying fields before forwarding. The AI service receives only clinical metrics, timestamps, and the opaque `patient_profile_id`.

### Response `200 OK`

```typescript
{
  request_id: string;
  model_version: string;
  summary_text: string;
  pattern_findings: PatternFinding[];
  confidence_context: ConfidenceContext | null;
  processing_time_ms: number;
}
```

---

## AI Service Design Constraints

- AI service MUST return a response within **30 seconds** or Fastify returns `503`.
- All model outputs MUST include `confidence` ratings — no silent low-confidence findings.
- No finding may include language that implies diagnosis, treatment recommendation, or clinical instruction.
- Findings that lack statistical support (< 3 data points) MUST be suppressed.
- Model version MUST be included in every response for reproducibility and audit.
- The AI service MUST NOT log patient identifiers, record IDs, or clinical values.
