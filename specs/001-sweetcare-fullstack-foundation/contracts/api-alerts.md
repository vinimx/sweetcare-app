# API Contract: Alerts & Emergency Guidance

**Service**: `apps/api` (Fastify)  
**Base path**: `/v1/alerts`  
**Version**: 1.0.0

> Alerts are read-only after creation. No alert may be deleted — only resolved.  
> Emergency alerts (`severity_level = 'emergency'`) MUST be created synchronously within the symptom write transaction.

---

## GET /v1/patients/{patientId}/alerts

Returns active alerts for a patient, ordered by creation time descending.

**Auth**: Bearer token, active CaregiverAssignment.

### Query parameters

| Param    | Type                        | Default    | Notes                       |
| -------- | --------------------------- | ---------- | --------------------------- |
| `status` | `active \| resolved \| all` | `active`   | Filter by resolution status |
| `from`   | ISO 8601 date               | 7 days ago |                             |
| `limit`  | integer                     | 20         | Max 100                     |
| `cursor` | string                      | —          | Opaque pagination cursor    |

### Response `200 OK`

```typescript
{
  alerts: AlertEvent[];
  next_cursor: string | null;
}

type AlertEvent = {
  alert_id: string;
  patient_profile_id: string;
  trigger_symptom_record_id: string;
  alert_type:
    | "hypoglycemia_risk"
    | "severe_hypoglycemia"
    | "ketoacidosis_risk"
    | "emergency_response_required";
  severity_level: "warning" | "critical" | "emergency";
  guidance_key: string;          // lookup key — mobile app resolves to localized content
  guidance_summary: string;      // short-form guidance text for notification body
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
};
```

---

## GET /v1/alerts/{alertId}

Returns a single alert with full guidance content.

### Response `200 OK`

```typescript
{
  alert_id: string;
  patient_profile_id: string;
  trigger_symptom_record_id: string;
  alert_type: string;
  severity_level: string;
  guidance_key: string;
  guidance: AlertGuidance;
  created_at: string;
  resolved_at: string | null;
}

type AlertGuidance = {
  title: string; // localized, short — fits notification title
  immediate_steps: string[]; // ordered action list for caregiver
  emergency_contacts: EmergencyContact[];
  seek_emergency_care: boolean; // when true: display emergency call button prominently
  disclaimer: string; // always present: "Este guia não substitui orientação médica"
};

type EmergencyContact = {
  label: string; // e.g., "SAMU", "Bombeiros"
  phone: string; // E.164 format
};
```

### Alert guidance keys and content mapping

| `guidance_key`            | `alert_type`                  | `seek_emergency_care` | Description                                  |
| ------------------------- | ----------------------------- | --------------------- | -------------------------------------------- |
| `HYPO_MILD_PROTOCOL`      | `hypoglycemia_risk`           | false                 | 15-15 rule for mild hypoglycemia             |
| `HYPO_SEVERE_PROTOCOL`    | `severe_hypoglycemia`         | false                 | Glucagon administration + monitoring         |
| `HYPO_EMERGENCY_PROTOCOL` | `emergency_response_required` | true                  | Loss of consciousness — call 192 immediately |
| `KETO_RISK_PROTOCOL`      | `ketoacidosis_risk`           | false                 | Hydration + ketone monitoring                |
| `KETO_EMERGENCY_PROTOCOL` | `emergency_response_required` | true                  | DKA suspected — emergency care required      |

---

## PATCH /v1/alerts/{alertId}/resolve

Marks an alert as resolved by the caregiver.

**Auth**: Bearer token, active CaregiverAssignment.

### Request

```typescript
{
  resolution_note?: string;   // max 500 chars; optional; no PHI required
}
```

### Response `200 OK`

```typescript
{
  alert_id: string;
  resolved_at: string;
  resolved_by_user_id: string;
}
```

### Error codes

| Code                     | HTTP | Condition                     |
| ------------------------ | ---- | ----------------------------- |
| `ALERT_NOT_FOUND`        | 404  |                               |
| `ALERT_ALREADY_RESOLVED` | 409  | `resolved_at` already set     |
| `FORBIDDEN`              | 403  | No active CaregiverAssignment |

---

## Alert Rule Engine (Internal)

Alert generation is synchronous and deterministic. Rules are evaluated in the API service — NOT in the AI service.

| Trigger condition                                                                            | Generated `alert_type`        | `severity_level` |
| -------------------------------------------------------------------------------------------- | ----------------------------- | ---------------- |
| `symptom_codes` contains `loss_of_consciousness` OR `seizure`                                | `emergency_response_required` | `emergency`      |
| `severity_level = 'severe'` AND any hypoglycemia code                                        | `severe_hypoglycemia`         | `critical`       |
| `severity_level = 'moderate'` AND any hypoglycemia code                                      | `hypoglycemia_risk`           | `warning`        |
| `symptom_codes` contains `ketoacidosis_risk` AND `severity_level IN ('severe', 'emergency')` | `ketoacidosis_risk`           | `critical`       |
| `symptom_codes` contains `ketoacidosis_risk` AND `severity_level = 'moderate'`               | `ketoacidosis_risk`           | `warning`        |

**Fail-safe**: If alert generation fails during a symptom write, the symptom record is still committed. A background job retries alert generation within 60 seconds. Alert creation failure is logged with `severity = critical` but does NOT roll back the symptom record.

---

## Push Notification Contract

Alerts trigger push notifications via FCM/APNs. Notification payload MUST NOT contain PHI.

```typescript
// FCM/APNs data payload (no PHI allowed)
{
  notification_type: "alert";
  alert_id: string;
  alert_type: string;
  severity_level: string;
  patient_profile_id: string; // used by app to route to correct patient context
  // NOTE: patient name, glucose values, and clinical details are NOT included
}
```

The mobile app fetches full alert content via `GET /v1/alerts/{alertId}` after receiving the notification.
