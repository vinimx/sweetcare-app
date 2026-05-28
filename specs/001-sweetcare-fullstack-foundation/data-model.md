# Data Model: SweetCare Fullstack Foundation

**Branch**: `001-sweetcare-fullstack-foundation` | **Date**: 2026-05-27

> PHI fields marked `[PHI-ENCRYPTED]` MUST be stored with AES-256-GCM column-level encryption via `pgcrypto`.
> Sensitive fields marked `[SENSITIVE]` MUST be hashed or masked in logs and excluded from API error responses.

---

## Entity Relationship Overview

```
Guardian (User) ──< CaregiverAssignment >── PatientProfile
PatientProfile ──< InsulinApplicationRecord
PatientProfile ──< SymptomRecord
SymptomRecord ──< AlertEvent
AlertEvent ──< AlertAcknowledgement
InsulinApplicationRecord >── AuditEntry
SymptomRecord >── AuditEntry
AlertEvent >── AuditEntry
PatientProfile ──< SyncEvent
PatientProfile ──< InsightReport
User ──< UserSession
User ──< ConsentRecord
```

---

## Entities

### User

Represents an authenticated caregiver, guardian, or healthcare professional.

| Column           | Type          | Constraints                     | Notes                                                       |
| ---------------- | ------------- | ------------------------------- | ----------------------------------------------------------- |
| `id`             | `UUID`        | PK, default `gen_random_uuid()` | Stable identifier                                           |
| `email`          | `TEXT`        | UNIQUE, NOT NULL                | `[SENSITIVE]` — hashed in logs                              |
| `password_hash`  | `TEXT`        | NOT NULL                        | `[SENSITIVE]` — argon2id, never logged                      |
| `role`           | `ENUM`        | NOT NULL                        | `guardian \| caregiver \| healthcare_professional \| admin` |
| `display_name`   | `TEXT`        | NOT NULL                        | `[PHI-ENCRYPTED]`                                           |
| `phone_e164`     | `TEXT`        | NULLABLE                        | `[PHI-ENCRYPTED]` — E.164 format                            |
| `is_active`      | `BOOLEAN`     | NOT NULL, default `true`        | Soft-disable without data deletion                          |
| `mfa_enabled`    | `BOOLEAN`     | NOT NULL, default `false`       | TOTP-based MFA                                              |
| `mfa_secret_enc` | `TEXT`        | NULLABLE                        | `[PHI-ENCRYPTED]` TOTP secret                               |
| `created_at`     | `TIMESTAMPTZ` | NOT NULL, default `now()`       |                                                             |
| `updated_at`     | `TIMESTAMPTZ` | NOT NULL, default `now()`       | Updated by trigger                                          |

**Indexes**: `(email)`, `(role, is_active)`

---

### ConsentRecord

Tracks LGPD Art. 14 guardian consent for processing a minor's health data.

| Column                 | Type          | Constraints                          | Notes                                                         |
| ---------------------- | ------------- | ------------------------------------ | ------------------------------------------------------------- |
| `id`                   | `UUID`        | PK                                   |                                                               |
| `guardian_user_id`     | `UUID`        | FK → `users.id`, NOT NULL            | The consenting guardian                                       |
| `patient_profile_id`   | `UUID`        | FK → `patient_profiles.id`, NOT NULL | The minor whose data is covered                               |
| `consent_type`         | `ENUM`        | NOT NULL                             | `data_processing \| ai_analysis \| data_sharing`              |
| `granted_at`           | `TIMESTAMPTZ` | NOT NULL                             | When consent was explicitly granted                           |
| `revoked_at`           | `TIMESTAMPTZ` | NULLABLE                             | Non-null triggers data processing freeze                      |
| `consent_text_version` | `TEXT`        | NOT NULL                             | Version of consent text shown (semantic version)              |
| `ip_address_hash`      | `TEXT`        | NOT NULL                             | SHA-256 of IP — for legal traceability without storing raw IP |
| `user_agent_hash`      | `TEXT`        | NOT NULL                             | SHA-256 of user-agent                                         |

**Business Rule**: `PatientProfile` MUST have an active `ConsentRecord` of type `data_processing` before any PHI write is accepted.

---

### PatientProfile

Represents a child (patient) managed by one or more caregivers.

| Column                    | Type           | Constraints               | Notes                                           |
| ------------------------- | -------------- | ------------------------- | ----------------------------------------------- |
| `id`                      | `UUID`         | PK                        |                                                 |
| `full_name`               | `TEXT`         | NOT NULL                  | `[PHI-ENCRYPTED]`                               |
| `date_of_birth`           | `DATE`         | NOT NULL                  | `[PHI-ENCRYPTED]`                               |
| `diagnosis_year`          | `SMALLINT`     | NOT NULL                  | Year of T1DM diagnosis                          |
| `target_glucose_min_mgdl` | `INTEGER`      | NOT NULL                  | Clinical target range minimum                   |
| `target_glucose_max_mgdl` | `INTEGER`      | NOT NULL                  | Clinical target range maximum                   |
| `insulin_type_basal`      | `TEXT`         | NULLABLE                  | `[PHI-ENCRYPTED]` Prescribed basal insulin name |
| `insulin_type_bolus`      | `TEXT`         | NULLABLE                  | `[PHI-ENCRYPTED]` Prescribed bolus insulin name |
| `icr_units_per_gram_carb` | `NUMERIC(5,2)` | NULLABLE                  | Insulin-to-carb ratio                           |
| `isf_mgdl_per_unit`       | `NUMERIC(6,2)` | NULLABLE                  | Insulin sensitivity factor                      |
| `created_by_user_id`      | `UUID`         | FK → `users.id`, NOT NULL | Guardian who created the profile                |
| `is_active`               | `BOOLEAN`      | NOT NULL, default `true`  |                                                 |
| `created_at`              | `TIMESTAMPTZ`  | NOT NULL, default `now()` |                                                 |
| `updated_at`              | `TIMESTAMPTZ`  | NOT NULL                  |                                                 |

**Indexes**: `(created_by_user_id)`, `(is_active)`

---

### CaregiverAssignment

Junction table — assigns caregivers to patient profiles with role context.

| Column               | Type          | Constraints                          | Notes                                                              |
| -------------------- | ------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `id`                 | `UUID`        | PK                                   |                                                                    |
| `patient_profile_id` | `UUID`        | FK → `patient_profiles.id`, NOT NULL |                                                                    |
| `user_id`            | `UUID`        | FK → `users.id`, NOT NULL            |                                                                    |
| `assignment_role`    | `ENUM`        | NOT NULL                             | `primary_guardian \| secondary_guardian \| caregiver \| read_only` |
| `granted_by_user_id` | `UUID`        | FK → `users.id`, NOT NULL            | Who granted this access                                            |
| `granted_at`         | `TIMESTAMPTZ` | NOT NULL                             |                                                                    |
| `revoked_at`         | `TIMESTAMPTZ` | NULLABLE                             | Non-null removes access                                            |

**Unique constraint**: `(patient_profile_id, user_id)` — prevents duplicate assignments.

---

### InsulinApplicationRecord

Immutable record of an insulin administration event. **Never updated after creation.**

| Column                | Type           | Constraints                          | Notes                                                 |
| --------------------- | -------------- | ------------------------------------ | ----------------------------------------------------- |
| `id`                  | `UUID`         | PK                                   |                                                       |
| `client_id`           | `UUID`         | UNIQUE, NOT NULL                     | Client-generated UUIDv7 for idempotency               |
| `patient_profile_id`  | `UUID`         | FK → `patient_profiles.id`, NOT NULL |                                                       |
| `recorded_by_user_id` | `UUID`         | FK → `users.id`, NOT NULL            |                                                       |
| `insulin_type`        | `TEXT`         | NOT NULL                             | `[PHI-ENCRYPTED]` e.g., `NovoRapid`, `Glargina`       |
| `dose_units`          | `NUMERIC(5,2)` | NOT NULL                             | Units administered; validated > 0 and ≤ 100           |
| `dose_rationale`      | `ENUM`         | NOT NULL                             | `correction \| meal_coverage \| basal \| combination` |
| `meal_carbs_grams`    | `INTEGER`      | NULLABLE                             | For meal-coverage rationale                           |
| `glucose_before_mgdl` | `INTEGER`      | NULLABLE                             | `[PHI-ENCRYPTED]` Pre-bolus glucose reading           |
| `administration_site` | `TEXT`         | NULLABLE                             | e.g., `abdomen_left`, `thigh_right`                   |
| `notes`               | `TEXT`         | NULLABLE                             | `[PHI-ENCRYPTED]` Free-text clinical note             |
| `applied_at`          | `TIMESTAMPTZ`  | NOT NULL                             | Caregiver-entered time of administration              |
| `recorded_at`         | `TIMESTAMPTZ`  | NOT NULL, default `now()`            | Server receipt time                                   |
| `sync_status`         | `ENUM`         | NOT NULL                             | `pending \| synced \| conflict`                       |
| `timezone`            | `TEXT`         | NOT NULL                             | IANA timezone of recording device                     |

**Constraints**:

- `CHECK (dose_units > 0 AND dose_units <= 100)` — safety guard against runaway values.
- No UPDATE or DELETE permitted by application code; corrections via new record with reference.

**Indexes**: `(patient_profile_id, applied_at DESC)`, `(client_id)`, `(sync_status)`

---

### SymptomRecord

Records caregiver-observed symptoms with structured severity data.

| Column                 | Type          | Constraints                          | Notes                                                                                                                                             |
| ---------------------- | ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `UUID`        | PK                                   |                                                                                                                                                   |
| `client_id`            | `UUID`        | UNIQUE, NOT NULL                     | Client-generated UUIDv7 for idempotency                                                                                                           |
| `patient_profile_id`   | `UUID`        | FK → `patient_profiles.id`, NOT NULL |                                                                                                                                                   |
| `recorded_by_user_id`  | `UUID`        | FK → `users.id`, NOT NULL            |                                                                                                                                                   |
| `symptom_codes`        | `TEXT[]`      | NOT NULL                             | Array of standardized codes: `hypoglycemia_mild`, `tremor`, `confusion`, `loss_of_consciousness`, `seizure`, `hyperglycemia`, `ketoacidosis_risk` |
| `severity_level`       | `ENUM`        | NOT NULL                             | `mild \| moderate \| severe \| emergency`                                                                                                         |
| `glucose_reading_mgdl` | `INTEGER`     | NULLABLE                             | `[PHI-ENCRYPTED]` Associated glucose at symptom time                                                                                              |
| `notes`                | `TEXT`        | NULLABLE                             | `[PHI-ENCRYPTED]`                                                                                                                                 |
| `observed_at`          | `TIMESTAMPTZ` | NOT NULL                             | Time symptoms were observed                                                                                                                       |
| `recorded_at`          | `TIMESTAMPTZ` | NOT NULL, default `now()`            |                                                                                                                                                   |
| `sync_status`          | `ENUM`        | NOT NULL                             | `pending \| synced \| conflict`                                                                                                                   |
| `timezone`             | `TEXT`        | NOT NULL                             |                                                                                                                                                   |

**Business Rule**: Any `severity_level = 'emergency'` record MUST trigger synchronous `AlertEvent` creation in the same transaction.

**Indexes**: `(patient_profile_id, observed_at DESC)`, `(severity_level)`, `(sync_status)`

---

### AlertEvent

Rule-based alert generated from symptom evaluation. Read-only after creation.

| Column                      | Type          | Constraints                          | Notes                                                                                          |
| --------------------------- | ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `id`                        | `UUID`        | PK                                   |                                                                                                |
| `patient_profile_id`        | `UUID`        | FK → `patient_profiles.id`, NOT NULL |                                                                                                |
| `trigger_symptom_record_id` | `UUID`        | FK → `symptom_records.id`, NOT NULL  | Causally linked record                                                                         |
| `alert_type`                | `ENUM`        | NOT NULL                             | `hypoglycemia_risk \| severe_hypoglycemia \| ketoacidosis_risk \| emergency_response_required` |
| `severity_level`            | `ENUM`        | NOT NULL                             | `warning \| critical \| emergency`                                                             |
| `guidance_key`              | `TEXT`        | NOT NULL                             | Key into guidance content map (e.g., `HYPO_SEVERE_PROTOCOL`)                                   |
| `notified_user_ids`         | `UUID[]`      | NOT NULL                             | Users who received push notification                                                           |
| `created_at`                | `TIMESTAMPTZ` | NOT NULL, default `now()`            |                                                                                                |
| `resolved_at`               | `TIMESTAMPTZ` | NULLABLE                             | Set when caregiver marks resolved                                                              |
| `resolved_by_user_id`       | `UUID`        | FK → `users.id`, NULLABLE            |                                                                                                |

**Indexes**: `(patient_profile_id, created_at DESC)`, `(alert_type, resolved_at)`

---

### SyncEvent

Records each synchronization attempt and its outcome.

| Column                 | Type          | Constraints                          | Notes                                                 |
| ---------------------- | ------------- | ------------------------------------ | ----------------------------------------------------- |
| `id`                   | `UUID`        | PK                                   |                                                       |
| `patient_profile_id`   | `UUID`        | FK → `patient_profiles.id`, NOT NULL |                                                       |
| `initiated_by_user_id` | `UUID`        | FK → `users.id`, NOT NULL            |                                                       |
| `sync_type`            | `ENUM`        | NOT NULL                             | `full \| partial \| conflict_resolution`              |
| `records_submitted`    | `INTEGER`     | NOT NULL                             | Count of records in this batch                        |
| `records_committed`    | `INTEGER`     | NOT NULL                             | Count successfully persisted                          |
| `records_conflicted`   | `INTEGER`     | NOT NULL                             | Count with conflicts detected                         |
| `conflict_details`     | `JSONB`       | NULLABLE                             | `[PHI-ENCRYPTED]` Array of conflict descriptors       |
| `status`               | `ENUM`        | NOT NULL                             | `initiated \| completed \| partial_failure \| failed` |
| `started_at`           | `TIMESTAMPTZ` | NOT NULL, default `now()`            |                                                       |
| `completed_at`         | `TIMESTAMPTZ` | NULLABLE                             |                                                       |
| `error_code`           | `TEXT`        | NULLABLE                             | Internal error code; never raw stack trace            |

**Indexes**: `(patient_profile_id, started_at DESC)`, `(status)`

---

### AuditEntry

Immutable trace of every write operation on critical records. Enforced append-only via RLS + trigger.

| Column            | Type          | Constraints               | Notes                                                                                                |
| ----------------- | ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`              | `UUID`        | PK                        |                                                                                                      |
| `actor_user_id`   | `UUID`        | FK → `users.id`, NOT NULL | Who performed the action                                                                             |
| `correlation_id`  | `UUID`        | NOT NULL                  | Request correlation ID — links to structured log                                                     |
| `operation`       | `ENUM`        | NOT NULL                  | `create \| update \| delete \| sync_commit \| alert_generated \| consent_granted \| consent_revoked` |
| `target_table`    | `TEXT`        | NOT NULL                  | e.g., `insulin_application_records`                                                                  |
| `target_id`       | `UUID`        | NOT NULL                  | PK of the affected record                                                                            |
| `diff_summary`    | `JSONB`       | NULLABLE                  | Changed field names only — NO values for PHI fields                                                  |
| `ip_address_hash` | `TEXT`        | NOT NULL                  | SHA-256 of client IP                                                                                 |
| `user_agent_hash` | `TEXT`        | NOT NULL                  | SHA-256 of user-agent                                                                                |
| `occurred_at`     | `TIMESTAMPTZ` | NOT NULL, default `now()` |                                                                                                      |

**RLS Policy**: No role may UPDATE or DELETE from `audit_entries`. INSERT only via designated audit service account.

**Indexes**: `(target_table, target_id)`, `(actor_user_id, occurred_at DESC)`, `(correlation_id)`

---

### InsightReport

Output of AI-assisted pattern analysis. Linked to snapshot of source records at generation time.

| Column                 | Type          | Constraints                          | Notes                                                                         |
| ---------------------- | ------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `id`                   | `UUID`        | PK                                   |                                                                               |
| `patient_profile_id`   | `UUID`        | FK → `patient_profiles.id`, NOT NULL |                                                                               |
| `requested_by_user_id` | `UUID`        | FK → `users.id`, NOT NULL            |                                                                               |
| `report_type`          | `ENUM`        | NOT NULL                             | `weekly_summary \| glucose_pattern \| insulin_effectiveness \| symptom_trend` |
| `period_start`         | `DATE`        | NOT NULL                             | Analysis window start (inclusive)                                             |
| `period_end`           | `DATE`        | NOT NULL                             | Analysis window end (inclusive)                                               |
| `ai_model_version`     | `TEXT`        | NOT NULL                             | Semantic version of AI service that produced the report                       |
| `summary_text`         | `TEXT`        | NOT NULL                             | `[PHI-ENCRYPTED]` Human-readable summary                                      |
| `pattern_findings`     | `JSONB`       | NOT NULL                             | `[PHI-ENCRYPTED]` Structured findings array                                   |
| `confidence_context`   | `JSONB`       | NULLABLE                             | Model confidence indicators and data coverage stats                           |
| `disclaimer_key`       | `TEXT`        | NOT NULL                             | Key for the regulatory disclaimer shown to user                               |
| `generated_at`         | `TIMESTAMPTZ` | NOT NULL, default `now()`            |                                                                               |
| `is_invalidated`       | `BOOLEAN`     | NOT NULL, default `false`            | Set true if source data was corrected after generation                        |

**Indexes**: `(patient_profile_id, generated_at DESC)`, `(report_type, period_start)`

---

### UserSession

Refresh token lineage tracking for family invalidation on theft detection.

| Column               | Type          | Constraints               | Notes                                                                  |
| -------------------- | ------------- | ------------------------- | ---------------------------------------------------------------------- |
| `id`                 | `UUID`        | PK                        |                                                                        |
| `user_id`            | `UUID`        | FK → `users.id`, NOT NULL |                                                                        |
| `family_id`          | `UUID`        | NOT NULL                  | All rotated tokens in a session share the same family                  |
| `token_hash`         | `TEXT`        | UNIQUE, NOT NULL          | `[SENSITIVE]` SHA-256 of the refresh token                             |
| `parent_token_hash`  | `TEXT`        | NULLABLE                  | Hash of the previous token in this family                              |
| `device_fingerprint` | `TEXT`        | NULLABLE                  | Hashed device metadata for anomaly detection                           |
| `issued_at`          | `TIMESTAMPTZ` | NOT NULL, default `now()` |                                                                        |
| `expires_at`         | `TIMESTAMPTZ` | NOT NULL                  | `now() + 7 days`                                                       |
| `revoked_at`         | `TIMESTAMPTZ` | NULLABLE                  | Non-null = invalidated                                                 |
| `revocation_reason`  | `ENUM`        | NULLABLE                  | `logout \| rotation_theft_detected \| admin_revoke \| password_change` |

**Business Rule**: If a token is reused after rotation, mark the entire `family_id` as revoked (theft detected).

---

## Database Security Controls

```sql
-- Row Level Security: enforce tenant isolation at DB layer
ALTER TABLE insulin_application_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY caregiver_access ON insulin_application_records
  USING (patient_profile_id IN (
    SELECT patient_profile_id FROM caregiver_assignments
    WHERE user_id = current_setting('app.current_user_id')::uuid
      AND revoked_at IS NULL
  ));

-- Audit table: no updates or deletes allowed
CREATE POLICY audit_insert_only ON audit_entries
  FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policies created → operations blocked by default
```

## Encryption Transform Pattern (Prisma Middleware)

```typescript
// Applied in Prisma middleware — PHI fields encrypted before write, decrypted after read
const PHI_FIELDS: Record<string, string[]> = {
  user: ["display_name", "phone_e164", "mfa_secret_enc"],
  patient_profile: ["full_name", "date_of_birth", "insulin_type_basal", "insulin_type_bolus"],
  insulin_application_record: ["insulin_type", "glucose_before_mgdl", "notes"],
  symptom_record: ["glucose_reading_mgdl", "notes"],
  insight_report: ["summary_text", "pattern_findings"],
};
```
