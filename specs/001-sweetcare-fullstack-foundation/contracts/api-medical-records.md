# API Contract: Medical Records (Insulin & Symptoms)

**Service**: `apps/api` (Fastify)  
**Base paths**: `/v1/patients`, `/v1/insulin-records`, `/v1/symptoms`  
**Version**: 1.0.0

> All write endpoints require `Authorization: Bearer <access_token>`.  
> All responses include `X-Correlation-Id` header for log tracing.  
> PHI fields in responses are only returned to users with active `CaregiverAssignment` for that patient.

---

## Patient Management

### POST /v1/patients

Creates a child patient profile. Requires active `ConsentRecord` of type `data_processing`.

**Auth**: Bearer token, role = `guardian`.

### Request

```typescript
{
  full_name: string;                     // 1–150 chars [PHI]
  date_of_birth: string;                 // ISO 8601 date [PHI]
  diagnosis_year: number;                // 4-digit year, ≤ current year
  target_glucose_min_mgdl: number;       // integer, 40–100
  target_glucose_max_mgdl: number;       // integer, 120–300; must be > min
  insulin_type_basal?: string;           // max 100 chars [PHI]
  insulin_type_bolus?: string;           // max 100 chars [PHI]
  icr_units_per_gram_carb?: number;      // numeric(5,2), 0.1–2.0
  isf_mgdl_per_unit?: number;            // numeric(6,2), 10–200
}
```

### Response `201 Created`

```typescript
{
  patient_id: string; // UUID
  created_at: string;
}
```

### Error codes

| Code                     | HTTP | Condition                                               |
| ------------------------ | ---- | ------------------------------------------------------- |
| `CONSENT_REQUIRED`       | 403  | No active `data_processing` consent for requesting user |
| `INVALID_GLUCOSE_RANGE`  | 422  | `max <= min` or values outside physiological bounds     |
| `PATIENT_LIMIT_EXCEEDED` | 422  | Guardian attempting to create more than 10 profiles     |

---

### GET /v1/patients/{patientId}

Returns the patient profile for authorized caregivers.

### Response `200 OK`

```typescript
{
  patient_id: string;
  full_name: string; // decrypted [PHI]
  date_of_birth: string; // decrypted [PHI]
  diagnosis_year: number;
  target_glucose_min_mgdl: number;
  target_glucose_max_mgdl: number;
  insulin_type_basal: string | null;
  insulin_type_bolus: string | null;
  icr_units_per_gram_carb: number | null;
  isf_mgdl_per_unit: number | null;
  is_active: boolean;
  created_at: string;
}
```

---

## Insulin Application Records

### POST /v1/patients/{patientId}/insulin-records

Creates an insulin application record. Idempotent via `client_id`.

**Auth**: Bearer token, active CaregiverAssignment.

### Request

```typescript
{
  client_id: string;             // UUIDv7, client-generated — idempotency key
  insulin_type: string;          // max 100 chars [PHI]
  dose_units: number;            // numeric(5,2), 0.01–100.00
  dose_rationale: "correction" | "meal_coverage" | "basal" | "combination";
  meal_carbs_grams?: number;     // integer 0–500, required when rationale = meal_coverage
  glucose_before_mgdl?: number;  // integer 20–600 [PHI]
  administration_site?: string;  // max 50 chars
  notes?: string;                // max 1000 chars [PHI]
  applied_at: string;            // ISO 8601 with timezone
  timezone: string;              // IANA timezone e.g. "America/Sao_Paulo"
}
```

### Response `201 Created`

```typescript
{
  record_id: string; // server-assigned UUID
  client_id: string; // echoed back for client confirmation
  sync_status: "synced";
  recorded_at: string;
}
```

### Response `200 OK` (duplicate `client_id`)

Same shape as 201 — idempotent. No second record created.

### Error codes

| Code                  | HTTP | Condition                                                   |
| --------------------- | ---- | ----------------------------------------------------------- |
| `PATIENT_NOT_FOUND`   | 404  | `patientId` not found or no access                          |
| `DOSE_OUT_OF_BOUNDS`  | 422  | `dose_units` > 100 or ≤ 0                                   |
| `MEAL_CARBS_REQUIRED` | 422  | `meal_coverage` rationale without `meal_carbs_grams`        |
| `INVALID_TIMESTAMP`   | 422  | `applied_at` > now + 5 minutes (future records not allowed) |
| `CONSENT_REVOKED`     | 403  | Patient's consent has been revoked                          |

---

### GET /v1/patients/{patientId}/insulin-records

Returns paginated insulin records, newest first.

### Query parameters

| Param    | Type          | Default    | Notes                      |
| -------- | ------------- | ---------- | -------------------------- |
| `from`   | ISO 8601 date | 7 days ago | Inclusive start            |
| `to`     | ISO 8601 date | today      | Inclusive end              |
| `limit`  | integer       | 50         | Max 200                    |
| `cursor` | string        | —          | Pagination cursor (opaque) |

### Response `200 OK`

```typescript
{
  records: InsulinRecord[];
  next_cursor: string | null;
  total_count: number;
}
```

---

## Symptom Records

### POST /v1/patients/{patientId}/symptoms

Creates a symptom observation record. Triggers synchronous `AlertEvent` creation if `severity_level = 'emergency'`.

**Auth**: Bearer token, active CaregiverAssignment.

### Request

```typescript
{
  client_id: string;             // UUIDv7
  symptom_codes: Array<
    | "hypoglycemia_mild"
    | "tremor"
    | "confusion"
    | "loss_of_consciousness"
    | "seizure"
    | "hyperglycemia"
    | "ketoacidosis_risk"
    | "excessive_thirst"
    | "frequent_urination"
    | "fatigue"
  >;                             // at least 1 required
  severity_level: "mild" | "moderate" | "severe" | "emergency";
  glucose_reading_mgdl?: number; // integer 20–600 [PHI]
  notes?: string;                // max 1000 chars [PHI]
  observed_at: string;           // ISO 8601 with timezone
  timezone: string;              // IANA timezone
}
```

### Response `201 Created`

```typescript
{
  record_id: string;
  client_id: string;
  alert_triggered: boolean;
  alert_id: string | null; // non-null when alert_triggered = true
  sync_status: "synced";
  recorded_at: string;
}
```

### Error codes

| Code                        | HTTP | Condition                                    |
| --------------------------- | ---- | -------------------------------------------- |
| `SYMPTOM_CODES_EMPTY`       | 422  | Empty `symptom_codes` array                  |
| `INVALID_SYMPTOM_CODE`      | 422  | Unrecognized code in array                   |
| `SEVERITY_SYMPTOM_MISMATCH` | 422  | `loss_of_consciousness` with `mild` severity |
| `PATIENT_NOT_FOUND`         | 404  |                                              |
| `CONSENT_REVOKED`           | 403  |                                              |

---

### GET /v1/patients/{patientId}/symptoms

Returns paginated symptom records.

Same query parameter shape as insulin records.

---

## Timeline (Composite Feed)

### GET /v1/patients/{patientId}/timeline

Returns a merged, time-ordered feed of insulin records, symptom records, and alerts. Used for the main caregiver dashboard.

### Query parameters

| Param    | Type            | Default                 |
| -------- | --------------- | ----------------------- |
| `from`   | ISO 8601        | 24 hours ago            |
| `to`     | ISO 8601        | now                     |
| `types`  | comma-separated | `insulin,symptom,alert` |
| `limit`  | integer         | 50                      |
| `cursor` | string          | —                       |

### Response `200 OK`

```typescript
{
  events: TimelineEvent[];    // polymorphic array; each event has `type` discriminant
  next_cursor: string | null;
}
```

```typescript
type TimelineEvent =
  | { type: "insulin"; data: InsulinRecord }
  | { type: "symptom"; data: SymptomRecord }
  | { type: "alert"; data: AlertSummary };
```

**Performance target**: p95 ≤ 300ms for the default 24-hour window with ≤ 200 events.

---

## Authorization Rules

| Operation              | Required role           | Additional check                                       |
| ---------------------- | ----------------------- | ------------------------------------------------------ |
| Create patient profile | `guardian`              | Active `data_processing` consent                       |
| Read patient data      | Any role                | Active `CaregiverAssignment` with `revoked_at IS NULL` |
| Write insulin record   | `guardian \| caregiver` | Active assignment                                      |
| Write symptom record   | `guardian \| caregiver` | Active assignment                                      |
| Delete insulin record  | Forbidden               | Records are immutable — no DELETE endpoint             |
| Delete symptom record  | Forbidden               | Records are immutable — no DELETE endpoint             |
