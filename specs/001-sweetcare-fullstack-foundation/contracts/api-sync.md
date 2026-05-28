# API Contract: Offline Synchronization

**Service**: `apps/api` (Fastify)  
**Base path**: `/v1/sync`  
**Version**: 1.0.0

> The sync API is the critical path for reconciling offline-created records.  
> All operations MUST be idempotent. No record is ever overwritten — only created.  
> Conflict detection is deterministic; auto-resolution is forbidden for medical records.

---

## POST /v1/sync/batch

Submits a batch of offline-created records for server-side persistence. Idempotent: records with known `client_id` values are skipped without error.

**Auth**: Bearer token, active CaregiverAssignment for all `patient_profile_id` values in the batch.

**Max batch size**: 100 records per request.

### Request

```typescript
{
  batch_id: string;              // UUIDv7, client-generated — idempotency for the batch itself
  patient_profile_id: string;    // All records in a batch must belong to the same patient
  records: SyncRecord[];
}

type SyncRecord =
  | { record_type: "insulin_application"; client_id: string; payload: InsulinRecordPayload }
  | { record_type: "symptom"; client_id: string; payload: SymptomRecordPayload };
```

Record payloads match the schemas in `api-medical-records.md` (excluding `client_id`, which is at the top level).

### Response `200 OK`

```typescript
{
  batch_id: string;
  committed: number;             // records successfully persisted for the first time
  skipped: number;               // records already known (duplicate client_id) — not an error
  conflicts: SyncConflict[];
  sync_event_id: string;         // server-side SyncEvent.id for tracing
}

type SyncConflict = {
  client_id: string;
  conflict_type:
    | "overlapping_insulin_window"    // two bolus records within 30-minute window
    | "concurrent_edit"               // client_id exists but payload differs (data integrity violation)
    | "patient_access_revoked"        // CaregiverAssignment revoked since offline record was created
    | "consent_revoked";              // Patient consent revoked
  details: string;                   // human-readable, no PHI
  requires_manual_resolution: boolean;
};
```

### Error codes

| Code                      | HTTP | Condition                                                  |
| ------------------------- | ---- | ---------------------------------------------------------- |
| `BATCH_TOO_LARGE`         | 413  | More than 100 records                                      |
| `MIXED_PATIENTS`          | 422  | Records for multiple patient IDs in one batch              |
| `INVALID_RECORD_TYPE`     | 422  | Unknown `record_type`                                      |
| `BATCH_ALREADY_COMMITTED` | 200  | Entire batch already processed — returns original response |

---

## GET /v1/sync/status/{patientId}

Returns the current sync state for a patient, including the last successful sync timestamp and any pending conflicts.

**Auth**: Bearer token, active CaregiverAssignment.

### Response `200 OK`

```typescript
{
  patient_profile_id: string;
  last_sync_at: string | null;         // ISO 8601; null if never synced
  pending_conflicts: ConflictSummary[];
  total_pending_local: number | null;  // client-reported; opaque to server
}

type ConflictSummary = {
  sync_event_id: string;
  conflict_count: number;
  oldest_conflict_at: string;
};
```

---

## POST /v1/sync/resolve-conflict

Records the caregiver's manual resolution decision for a conflict.

**Auth**: Bearer token. Only the user who triggered the original sync may resolve, or a `guardian` for the same patient.

### Request

```typescript
{
  client_id: string;         // the conflicting record's client_id
  resolution: "keep_local" | "keep_server" | "discard";
  resolution_note?: string;  // optional caregiver note, max 500 chars, no PHI
}
```

- `keep_local`: Persists the client's offline version as a new record alongside the server version.
- `keep_server`: Marks the conflict resolved; local version discarded.
- `discard`: Both versions flagged as discarded; creates audit entry.

### Response `200 OK`

```typescript
{
  client_id: string;
  resolution: string;
  resolved_at: string;
  audit_entry_id: string;
}
```

### Error codes

| Code                        | HTTP | Condition                                                     |
| --------------------------- | ---- | ------------------------------------------------------------- |
| `CONFLICT_NOT_FOUND`        | 404  | `client_id` has no outstanding conflict                       |
| `CONFLICT_ALREADY_RESOLVED` | 409  | Already resolved                                              |
| `FORBIDDEN`                 | 403  | Requesting user is not authorized to resolve for this patient |

---

## Sync Protocol (Mobile Client)

### Happy path

```
1. Client creates records offline → stored in local SQLite with sync_status = 'pending'
2. Network restored → client collects all 'pending' records
3. Client calls POST /v1/sync/batch (batches of ≤ 100)
4. Server responds with committed/skipped/conflicts counts
5. Client updates local sync_status for each record:
   - committed → 'synced'
   - skipped → 'synced'  (already on server)
   - conflicted → 'conflict'
6. Client presents conflict resolution UI for any conflicts
7. Caregiver resolves each conflict via POST /v1/sync/resolve-conflict
8. All records now in 'synced' state → sync indicator clears
```

### Retry policy

- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max), then every 60s.
- Jitter ±20% to prevent thundering herd after connectivity restored.
- A batch that returns `5xx` is retried. A batch that returns `4xx` is not retried — presented to user.

### Conflict window rules

| Conflict type                | Detection rule                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `overlapping_insulin_window` | Two bolus records for the same patient within 30 minutes of each other AND submitted in the same or consecutive sync batches |
| `concurrent_edit`            | `client_id` already exists on server with a different payload hash                                                           |

Auto-resolution is **never applied** to medical records. Every conflict requires explicit caregiver decision.
