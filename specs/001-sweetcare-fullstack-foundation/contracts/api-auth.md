# API Contract: Authentication & Session Management

**Service**: `apps/api` (Fastify)  
**Base path**: `/v1/auth`  
**Version**: 1.0.0

> All endpoints return `Content-Type: application/json`.  
> All error responses follow: `{ "error": "ERROR_CODE", "message": "human-readable", "correlationId": "uuid" }`.  
> PHI MUST NOT appear in error bodies or response logs.

---

## POST /v1/auth/register

Registers a new user. Requires a subsequent `POST /v1/consent` before any patient profile can be created.

### Request

```typescript
{
  email: string;            // valid email, max 254 chars
  password: string;         // min 12 chars, complexity enforced server-side
  role: "guardian" | "caregiver" | "healthcare_professional";
  display_name: string;     // 1–100 chars
  phone_e164?: string;      // E.164 format, optional
}
```

### Response `201 Created`

```typescript
{
  user_id: string; // UUID
  role: string;
  created_at: string; // ISO 8601
}
```

### Error codes

| Code                          | HTTP | Condition                         |
| ----------------------------- | ---- | --------------------------------- |
| `EMAIL_ALREADY_REGISTERED`    | 409  | Duplicate email                   |
| `INVALID_PASSWORD_COMPLEXITY` | 422  | Does not meet strength policy     |
| `INVALID_ROLE`                | 422  | Role not in allowed enum          |
| `RATE_LIMITED`                | 429  | > 5 registrations per IP per hour |

---

## POST /v1/auth/login

Authenticates a user. Returns short-lived access token and sets `HttpOnly` refresh token cookie.

### Request

```typescript
{
  email: string;
  password: string;
  device_fingerprint?: string;  // hashed client device metadata
}
```

### Response `200 OK`

```typescript
{
  access_token: string; // JWT, 15-minute expiry
  token_type: "Bearer";
  expires_in: 900; // seconds
  user_id: string;
  role: string;
}
```

**Set-Cookie header** (server sets; client must not store manually):

```
refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/v1/auth/refresh; Max-Age=604800
```

### Error codes

| Code                  | HTTP | Condition                                                                    |
| --------------------- | ---- | ---------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS` | 401  | Email/password mismatch — same message for both cases (prevents enumeration) |
| `ACCOUNT_DISABLED`    | 403  | `is_active = false`                                                          |
| `MFA_REQUIRED`        | 403  | MFA enabled; must complete `/v1/auth/mfa/verify` next                        |
| `RATE_LIMITED`        | 429  | > 10 attempts per IP per 15 minutes                                          |

---

## POST /v1/auth/refresh

Rotates the refresh token. The old token is immediately invalidated. If a previously rotated token is reused, the entire session family is revoked (theft detection).

### Request

Refresh token read from `HttpOnly` cookie — no body required.

### Response `200 OK`

```typescript
{
  access_token: string;
  token_type: "Bearer";
  expires_in: 900;
}
```

New `refresh_token` cookie is set.

### Error codes

| Code                     | HTTP | Condition                                                  |
| ------------------------ | ---- | ---------------------------------------------------------- |
| `REFRESH_TOKEN_INVALID`  | 401  | Token not found or already revoked                         |
| `REFRESH_TOKEN_EXPIRED`  | 401  | `expires_at` exceeded                                      |
| `SESSION_FAMILY_REVOKED` | 401  | Reuse of rotated token detected; entire family invalidated |

---

## POST /v1/auth/logout

Revokes the current refresh token family.

### Request

Refresh token from `HttpOnly` cookie.

### Response `204 No Content`

Cookie cleared via `Set-Cookie: refresh_token=; Max-Age=0`.

---

## POST /v1/auth/mfa/verify

Verifies TOTP code during MFA-gated login flow.

### Request

```typescript
{
  totp_code: string; // 6-digit code
  session_token: string; // temporary session token from MFA_REQUIRED response
}
```

### Response `200 OK`

Same shape as `/v1/auth/login` successful response.

### Error codes

| Code              | HTTP | Condition                                         |
| ----------------- | ---- | ------------------------------------------------- |
| `INVALID_TOTP`    | 401  | Code mismatch or expired                          |
| `SESSION_EXPIRED` | 401  | Temporary session token expired (5-minute window) |

---

## POST /v1/consent

Records LGPD Art. 14 guardian consent. **Required** before creating a `PatientProfile` for a minor.

**Auth**: Bearer token required.

### Request

```typescript
{
  patient_profile_id?: string;  // UUID — omit when granting consent before profile creation
  consent_type: "data_processing" | "ai_analysis" | "data_sharing";
  consent_text_version: string;  // semantic version of the consent text shown
}
```

### Response `201 Created`

```typescript
{
  consent_id: string;
  consent_type: string;
  granted_at: string;
}
```

---

## DELETE /v1/consent/{consentId}

Revokes a consent record. Triggers data processing freeze for the linked patient profile.

**Auth**: Bearer token required. Only the granting guardian may revoke.

### Response `200 OK`

```typescript
{
  consent_id: string;
  revoked_at: string;
  affected_patient_profile_id: string | null;
}
```

### Error codes

| Code                      | HTTP | Condition                                |
| ------------------------- | ---- | ---------------------------------------- |
| `CONSENT_NOT_FOUND`       | 404  |                                          |
| `CONSENT_ALREADY_REVOKED` | 409  | `revoked_at` already set                 |
| `FORBIDDEN`               | 403  | Requesting user is not the consent owner |

---

## Security Requirements

- All auth endpoints enforce `@fastify/rate-limit` with sliding window.
- `password` field MUST be argon2id-hashed before storage; never logged.
- Access token `sub` = `user_id`; `jti` = unique token ID for revocation checks.
- `aud` claim = `"sweetcare-api"` — validated on every protected route.
- CORS restricted to allowed mobile app origins; wildcard `*` not permitted.
- Failed login attempts trigger progressive delay (100ms × 2^n, max 30s) per IP.
