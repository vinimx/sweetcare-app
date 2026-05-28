# Research: SweetCare Fullstack Foundation

**Branch**: `001-sweetcare-fullstack-foundation` | **Date**: 2026-05-27

## 1. Security Architecture Decision — Children's Health Data

### Decision: Defense-in-Depth with LGPD Art. 14 Compliance

SweetCare processes Protected Health Information (PHI) belonging to **minors under care**. Brazilian Law 13.709/2018 (LGPD), Article 14, mandates special treatment for children's personal data, requiring:

- Processing only with **explicit, specific, and informed consent** from a parent or legal guardian.
- Strict **data minimization** — collect only what is clinically and operationally necessary.
- No commercial exploitation of children's data under any circumstance.
- Immediate response to guardian requests for access, correction, portability, or deletion.
- ANPD (Autoridade Nacional de Proteção de Dados) notification within **72 hours** of confirmed data breaches.

### Chosen Approach: Column-Level Encryption + Layered Controls

**Rationale**: Disk-level encryption alone does not protect against application vulnerabilities (SQL injection, misconfigured access, insider threat). Column-level encryption ensures PHI is ciphertext even in database dumps, query logs, and backup artifacts.

| Layer              | Control                                                                                 | Choice                                        |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| Transport          | TLS 1.3 minimum, no fallback                                                            | Enforced via reverse proxy (nginx/Caddy)      |
| Application        | Column-level AES-256-GCM via `pgcrypto` + app-layer transforms                          | Prisma middleware + `pgcrypto` for PHI fields |
| Mobile storage     | Encrypted SQLite (SQLCipher via `expo-sqlite`) + `expo-secure-store` for secrets        | Never AsyncStorage for PHI                    |
| Authentication     | Short-lived JWT (15 min access) + rotating refresh tokens (7d) with family invalidation | Detects token theft via lineage tracking      |
| Authorization      | RBAC: `guardian`, `caregiver`, `healthcare_professional`, `admin`                       | Enforced at route + service + query layers    |
| Logging            | Structured logs with zero PHI — patient IDs replaced by opaque correlation UUIDs        | Pino + redaction plugin                       |
| Audit trail        | Immutable append-only `audit_entries` table; signed records with actor + timestamp      | Write-once rows, no UPDATE/DELETE             |
| Key management     | Secrets via environment secrets; production: AWS Secrets Manager or HashiCorp Vault     | Key rotation documented in runbook            |
| Data residency     | All PHI stored in Brazilian-region databases (LGPD compliance)                          | PostgreSQL in br-east region                  |
| Consent management | Guardian consent records stored separately from patient data; linked by reference       | Consent revocation cascades to data freeze    |

### Rejected Alternatives

| Option                        | Reason Rejected                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| AsyncStorage for offline PHI  | Unencrypted on device; Android/iOS backup may expose data                           |
| Disk-only encryption          | Does not protect against application-layer SQL injection or misconfigured DB access |
| Symmetric key embedded in app | Static key compromise exposes all historical data; no rotation path                 |
| Third-party analytics SDKs    | Risk of PHI leakage through crash reports, event payloads, or network inspection    |

---

## 2. Technology Stack Decisions

### 2.1 Monorepo: pnpm Workspaces + Turborepo

**Chosen over**: Nx, Lerna, npm workspaces.

**Rationale**:

- Turborepo provides task-graph caching without code generation overhead.
- pnpm's strict hoisting prevents phantom dependency bugs in shared packages.
- Simpler setup than Nx for a team starting from scratch.
- Native TypeScript project references integrate cleanly with Turborepo pipelines.

### 2.2 Mobile: React Native + Expo + Tamagui

**Chosen over**: Flutter, NativeScript.

**Rationale**:

- React Native allows code sharing with web targets via shared-types and shared-validation packages.
- Expo SDK abstracts platform-specific security APIs (`expo-secure-store`, `expo-local-authentication`).
- Tamagui provides a typed, performant design system optimized for React Native performance constraints.
- Expo EAS Build integrates into CI without Mac build machines for Android targets.

**Key libraries**:

| Library                         | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `expo-secure-store`             | Encrypted key-value for tokens and small secrets (iOS Keychain / Android Keystore) |
| `expo-sqlite` (SQLCipher build) | Encrypted local SQLite for offline PHI records                                     |
| `@tanstack/react-query`         | Server state, offline mutation queue, background sync                              |
| `react-hook-form` + `zod`       | Validated forms with runtime schema checks                                         |
| `expo-local-authentication`     | Biometric unlock before accessing the app                                          |

### 2.3 API: Fastify + TypeScript

**Chosen over**: Express, NestJS, Hono.

**Rationale**:

- Fastify has schema-first request validation via `fastify-type-provider-zod`, eliminating a separate validation layer.
- Plugin architecture enforces explicit dependency injection without reflection-based magic.
- Benchmarks show 2–3× throughput advantage over Express under identical load for JSON-heavy APIs.
- NestJS rejected for its Angular-derived decorator patterns that obscure dependency boundaries, conflicting with Constitution Principle V.

**Key libraries**:

| Library               | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `zod`                 | Schema definition, shared with mobile via `shared-validation`                 |
| `@fastify/jwt`        | JWT creation and verification with JWKS rotation support                      |
| `@fastify/rate-limit` | Abuse protection on auth and critical write endpoints                         |
| `@fastify/helmet`     | HTTP security headers (CSP, HSTS, X-Frame-Options)                            |
| `pino`                | Structured JSON logging with redaction config for PHI fields                  |
| `prisma`              | Type-safe ORM with migration management; middleware for encryption transforms |

### 2.4 Database: PostgreSQL 16

**Chosen over**: MySQL, MongoDB, CockroachDB.

**Rationale**:

- `pgcrypto` extension enables column-level encryption without application complexity.
- Strong ACID guarantees are required for medical record integrity (Constitution Principle I).
- `ROW LEVEL SECURITY` policies enforce multi-tenant data isolation at the database layer.
- `pgaudit` extension for immutable query audit logs in regulated environments.
- JSONB support for flexible symptom metadata without sacrificing query capabilities.

### 2.5 AI Service: FastAPI + Python 3.12

**Chosen over**: integrating AI directly in Fastify.

**Rationale**:

- Isolation prevents AI service instability from affecting core caregiving workflows.
- Python ecosystem (NumPy, pandas, scikit-learn) for statistical analysis without Node.js bindings.
- FastAPI provides automatic OpenAPI docs, Pydantic validation, and async I/O.
- Clear service boundary enforces Constitution Principle V: domain logic isolated from AI tooling.
- Separate deployment allows independent scaling and rollback of AI features.

---

## 3. Offline Synchronization Architecture

### Pattern: Optimistic Local Write + Server Reconciliation

```
Mobile Client                  API (Fastify)               PostgreSQL
     │                              │                           │
     │── write locally (SQLCipher) ─┤                           │
     │── mark record as PENDING ────┤                           │
     │                              │                           │
     │── [connectivity restored] ───┤                           │
     │── POST /v1/sync/batch ───────>                           │
     │                              │── validate + idempotency ─>
     │                              │<─ persisted / conflict ───│
     │<─ { committed, conflicts } ──│                           │
     │── resolve conflicts (UI) ────┤                           │
     │── update local state ────────┤                           │
```

**Idempotency**: Every offline record carries a client-generated `client_id` (UUIDv7, time-ordered). Server uses `INSERT ... ON CONFLICT (client_id) DO NOTHING` to prevent duplication.

**Conflict resolution**:

- Timestamp conflicts (same patient, overlapping insulin window): surfaced to caregiver for manual resolution.
- Field-level merges not attempted for medical data — patient safety requires explicit human decision.
- Auto-resolution only for non-conflicting concurrent records (different timestamps, different record types).

**Offline queue durability**: React Query `persistQueryClient` backed by SQLCipher storage. Mutations survive app restart and OS kill.

---

## 4. Key Architectural Risks and Mitigations

| Risk                                      | Likelihood              | Impact   | Mitigation                                                                                  |
| ----------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------- |
| Token expiry during emergency logging     | High (mobile scenarios) | High     | Background token refresh; fallback to offline queue with no auth required for local write   |
| Sync conflict data loss                   | Medium                  | Critical | Server-side conflict detection + UI resolution flow; never auto-discard caregiver data      |
| AI service degradation                    | Medium                  | Low      | Fastify API returns cached/stale insights with staleness notice; core caregiving unaffected |
| PHI in crash reports                      | High                    | Critical | Sentry/Bugsnag PII scrubbing config; correlation IDs only in error payloads                 |
| SQLCipher key compromise on rooted device | Low                     | Critical | Biometric-gated key derivation; remote wipe via server-side session invalidation            |
| PostgreSQL connection pool exhaustion     | Medium                  | High     | PgBouncer in transaction pooling mode; circuit breaker in Fastify plugin                    |

---

## 5. Compliance Checklist

- [x] LGPD Art. 14: guardian consent flow required before creating `PatientProfile` for minors
- [x] LGPD Art. 18: right to access, correction, portability, deletion — mapped to API endpoints
- [x] LGPD Art. 48: breach notification workflow documented in incident runbook
- [x] OWASP Top 10 2021: mitigations mapped in security gate checklist
- [x] WCAG 2.1 AA: accessibility required for all critical-flow screens
- [x] No cross-border PHI transfer without explicit LGPD Chapter V compliance
- [ ] DPO appointment: required when processing scale warrants (document when threshold reached)
