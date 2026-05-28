# Tasks: SweetCare Fullstack Foundation

**Input**: Design documents from `/specs/001-sweetcare-fullstack-foundation/`

**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · data-model.md ✓ · contracts/ ✓ · quickstart.md ✓

**Constitution**: `.specify/memory/constitution.md` v1.0.0 — all phases gate-checked.

**Organization**: Tasks grouped by phase and user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US1/2/3]**: User story ownership from spec.md
- Exact file paths in all descriptions

---

## Phase 1: Setup — Monorepo & Tooling

**Purpose**: Initialize the multi-service monorepo, package manager, shared config, and CI skeleton.  
No user story work can begin until Phase 2 (Foundational) is complete, but setup tasks can run in parallel.

- [x] T001 Initialize pnpm workspaces monorepo with `pnpm-workspace.yaml` and root `package.json` at repo root
- [x] T002 [P] Configure Turborepo pipeline in `turbo.json` with `build`, `test`, `lint`, `typecheck` tasks
- [x] T003 [P] Configure TypeScript 5.x project references: root `tsconfig.base.json` + per-package `tsconfig.json`
- [x] T004 [P] Configure ESLint + Prettier + `lint-staged` + Husky pre-commit in root `package.json`
- [x] T005 [P] Initialize `packages/shared-types` workspace with TypeScript and core domain type stubs in `packages/shared-types/src/index.ts`
- [x] T006 [P] Initialize `packages/shared-validation` workspace with Zod and schema stubs in `packages/shared-validation/src/index.ts`
- [x] T007 [P] Initialize `packages/shared-config` workspace with env schema and constants in `packages/shared-config/src/index.ts`
- [x] T008 Initialize Fastify TypeScript API project in `apps/api/` with `package.json`, `tsconfig.json`, `src/server.ts`
- [x] T009 [P] Initialize Expo React Native project in `apps/mobile/` with Expo SDK, Tamagui, and base app structure in `apps/mobile/app/`
- [x] T010 [P] Initialize FastAPI Python project in `apps/ai-service/` with `pyproject.toml`, `app/main.py`, Pydantic v2
- [x] T011 [P] Create Docker Compose dev stack in `infra/docker/compose.dev.yml` (PostgreSQL 16, Redis 7, ai-service)
- [x] T012 [P] Create `.env.example` files in `apps/api/.env.example`, `apps/ai-service/.env.example` with all required variables documented
- [x] T013 [P] Set up GitHub Actions CI in `.github/workflows/ci.yml` with lint, typecheck, test, build jobs per service

**Checkpoint**: Monorepo installs, TypeScript compiles, Docker Compose starts, CI pipeline runs.

---

## Phase 2: Foundational — Auth, Database, Audit, Shared Domain

**Purpose**: Core infrastructure required before ANY user story implementation. Blocks all US phases.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T014 Write initial Prisma schema with all entities from `data-model.md` in `apps/api/prisma/schema.prisma`
- [x] T015 Create and validate Prisma migration `apps/api/prisma/migrations/001_initial_schema.sql` with RLS policies and pgcrypto extension
- [x] T016 [P] Implement Prisma PHI encryption middleware in `apps/api/src/infrastructure/database/encryption-middleware.ts` (AES-256-GCM for PHI fields per data-model.md)
- [x] T017 [P] Implement database connection pool with PgBouncer config and circuit breaker plugin in `apps/api/src/infrastructure/database/client.ts`
- [x] T018 Implement JWT authentication plugin (15min access + 7d refresh rotation + family invalidation) in `apps/api/src/infrastructure/auth/jwt.plugin.ts`
- [x] T019 [P] Implement RBAC authorization middleware (guardian, caregiver, healthcare_professional, admin) in `apps/api/src/infrastructure/auth/rbac.middleware.ts`
- [x] T020 [P] Implement refresh token repository with family invalidation logic in `apps/api/src/infrastructure/auth/session.repository.ts`
- [x] T021 Implement audit log service (append-only writes, no UPDATE/DELETE) in `apps/api/src/application/audit/audit.service.ts`
- [x] T022 [P] Configure Pino structured logger with PHI redaction plugin (zero patient identifiers in logs) in `apps/api/src/infrastructure/logging/logger.ts`
- [x] T023 [P] Implement `@fastify/rate-limit` and `@fastify/helmet` global plugins in `apps/api/src/infrastructure/http/security-plugins.ts`
- [x] T024 [P] Implement health check and readiness endpoints in `apps/api/src/presentation/routes/health.routes.ts`
- [x] T025 [P] Define all core domain types in `packages/shared-types/src/` (PatientProfile, InsulinApplicationRecord, SymptomRecord, AlertEvent, SyncEvent, AuditEntry, InsightReport)
- [x] T026 [P] Define all Zod validation schemas in `packages/shared-validation/src/` mirroring contracts in `contracts/`
- [x] T027 Implement POST /v1/auth/register and POST /v1/consent routes per `contracts/api-auth.md` in `apps/api/src/presentation/routes/auth.routes.ts`
- [x] T028 [P] Implement POST /v1/auth/login, POST /v1/auth/refresh, POST /v1/auth/logout routes in `apps/api/src/presentation/routes/auth.routes.ts`
- [x] T029 [P] Configure Expo SecureStore token storage and `expo-sqlite` (SQLCipher) local DB in `apps/mobile/src/infrastructure/storage/`

**Checkpoint**: Auth flow works end-to-end (register → consent → login → refresh → logout). DB migrations run clean. Audit logs written for auth operations. PHI encryption verified on raw DB query.

---

## Phase 3: User Story 1 — Offline Medical Records + Sync (Priority: P1) 🎯 MVP

**Goal**: Caregivers can record insulin applications and symptoms offline and synchronize safely without data loss or duplication.

**Independent Test**: Quickstart.md Cenário 1 — offline write → airplane mode → reconnect → sync → verify no duplicates → conflict test.

### Implementation for User Story 1

- [ ] T030 [P] [US1] Implement InsulinApplicationRecord domain entity with validation rules (dose bounds, rationale constraints) in `apps/api/src/domain/entities/insulin-application-record.entity.ts`
- [ ] T031 [P] [US1] Implement SymptomRecord domain entity with severity-symptom consistency rules in `apps/api/src/domain/entities/symptom-record.entity.ts`
- [ ] T032 [US1] Implement InsulinApplicationRecord repository (idempotent upsert via client_id) in `apps/api/src/infrastructure/repositories/insulin-record.repository.ts`
- [ ] T033 [P] [US1] Implement SymptomRecord repository in `apps/api/src/infrastructure/repositories/symptom-record.repository.ts`
- [ ] T034 [US1] Implement InsulinApplicationRecord application service with audit integration in `apps/api/src/application/services/insulin-record.service.ts`
- [ ] T035 [P] [US1] Implement SymptomRecord application service with audit integration in `apps/api/src/application/services/symptom-record.service.ts`
- [ ] T036 [US1] Implement sync batch service with conflict detection (overlapping_insulin_window rule) in `apps/api/src/application/services/sync-batch.service.ts`
- [ ] T037 [P] [US1] Implement CaregiverAssignment authorization guard (per-patient access check) in `apps/api/src/domain/services/caregiver-access.guard.ts`
- [ ] T038 [US1] Implement POST /v1/patients and GET /v1/patients/{id} routes per `contracts/api-medical-records.md` in `apps/api/src/presentation/routes/patients.routes.ts`
- [ ] T039 [P] [US1] Implement POST /v1/patients/{id}/insulin-records and GET routes in `apps/api/src/presentation/routes/insulin-records.routes.ts`
- [ ] T040 [P] [US1] Implement POST /v1/patients/{id}/symptoms and GET routes in `apps/api/src/presentation/routes/symptom-records.routes.ts`
- [ ] T041 [US1] Implement POST /v1/sync/batch, GET /v1/sync/status, POST /v1/sync/resolve-conflict per `contracts/api-sync.md` in `apps/api/src/presentation/routes/sync.routes.ts`
- [ ] T042 [US1] Implement GET /v1/patients/{id}/timeline composite feed endpoint in `apps/api/src/presentation/routes/timeline.routes.ts`
- [ ] T043 [P] [US1] Implement offline SQLite schema and record repository in `apps/mobile/src/infrastructure/storage/offline-db.ts`
- [ ] T044 [US1] Implement offline mutation queue with React Query `persistQueryClient` in `apps/mobile/src/infrastructure/sync/offline-queue.ts`
- [ ] T045 [US1] Implement sync engine with auto-trigger on connectivity restore in `apps/mobile/src/infrastructure/sync/sync-engine.ts`
- [ ] T046 [P] [US1] Build insulin logging screen with react-hook-form + Zod validation in `apps/mobile/src/features/insulin/screens/InsulinLogScreen.tsx`
- [ ] T047 [P] [US1] Build symptom recording screen in `apps/mobile/src/features/symptoms/screens/SymptomRecordScreen.tsx`
- [ ] T048 [US1] Build sync status indicator component and conflict resolution UI in `apps/mobile/src/features/sync/components/SyncStatusBar.tsx`
- [ ] T049 [US1] Write integration tests for offline-sync flow (offline write → sync → idempotency → conflict) in `apps/api/tests/integration/sync-flow.test.ts`

**Checkpoint**: Quickstart.md Cenário 1 passes completely. All acceptance scenarios from spec.md US1 validated.

---

## Phase 4: User Story 2 — Alerts & Emergency Guidance (Priority: P2)

**Goal**: Caregivers receive rule-based alerts and emergency guidance after registering high-severity symptoms.

**Independent Test**: Quickstart.md Cenário 2 — POST severe/emergency symptom → alert created → push sent → emergency UI loads in ≤ 2s → resolve.

### Implementation for User Story 2

- [ ] T050 [P] [US2] Implement AlertEvent domain entity with alert type and rule-mapping logic in `apps/api/src/domain/entities/alert-event.entity.ts`
- [ ] T051 [US2] Implement synchronous rule engine that maps symptom codes + severity to alert types per `contracts/api-alerts.md` in `apps/api/src/domain/services/alert-rule-engine.ts`
- [ ] T052 [US2] Integrate alert generation into SymptomRecord application service (same transaction for emergency severity) in `apps/api/src/application/services/symptom-record.service.ts`
- [ ] T053 [P] [US2] Implement AlertEvent repository in `apps/api/src/infrastructure/repositories/alert-event.repository.ts`
- [ ] T054 [US2] Implement push notification service (FCM/APNs) with PHI-free payload per `contracts/api-alerts.md` in `apps/api/src/infrastructure/notifications/push-notification.service.ts`
- [ ] T055 [P] [US2] Implement GET /v1/patients/{id}/alerts, GET /v1/alerts/{id}, PATCH /v1/alerts/{id}/resolve per `contracts/api-alerts.md` in `apps/api/src/presentation/routes/alerts.routes.ts`
- [ ] T056 [US2] Build alert detail screen with emergency guidance display (seek_emergency_care = true → prominent call button) in `apps/mobile/src/features/alerts/screens/AlertDetailScreen.tsx`
- [ ] T057 [P] [US2] Build emergency protocol screen (lock-screen-style, no auth required to view once unlocked) in `apps/mobile/src/features/alerts/screens/EmergencyProtocolScreen.tsx`
- [ ] T058 [US2] Integrate push notification handling and deep-link routing to alert screen in `apps/mobile/src/infrastructure/notifications/notification-handler.ts`
- [ ] T059 [US2] Write integration tests for alert generation flow (symptom → alert → push → resolve) in `apps/api/tests/integration/alert-flow.test.ts`

**Checkpoint**: Quickstart.md Cenário 2 passes. Emergency screen loads ≤ 2s. Accessibility check passes on critical screens.

---

## Phase 5: User Story 3 — AI Insights & Reports (Priority: P3)

**Goal**: Caregivers can request and view explainable AI-assisted insights with mandatory safety disclaimers.

**Independent Test**: Quickstart.md Cenário 3 — POST report request with 7+ days fixtures → poll until completed → verify disclaimer present → simulate AI outage → verify core flows unaffected.

### Implementation for User Story 3

- [ ] T060 [P] [US3] Implement InsightReport domain entity in `apps/api/src/domain/entities/insight-report.entity.ts`
- [ ] T061 [US3] Implement data aggregation pipeline that strips PHI before forwarding to AI service in `apps/api/src/application/services/insight-aggregation.service.ts`
- [ ] T062 [US3] Implement InsightReport repository in `apps/api/src/infrastructure/repositories/insight-report.repository.ts`
- [ ] T063 [P] [US3] Implement AI service HTTP client with 30s timeout, retry, and circuit breaker in `apps/api/src/infrastructure/ai/ai-service-client.ts`
- [ ] T064 [US3] Implement Fastify proxy routes POST /v1/insights/reports, GET /v1/insights/reports/{id}, GET /v1/insights/reports per `contracts/api-insights.md` in `apps/api/src/presentation/routes/insights.routes.ts`
- [ ] T065 [P] [US3] Implement FastAPI POST /v1/analyze endpoint with Pydantic schemas in `apps/ai-service/app/api/analyze.py`
- [ ] T066 [P] [US3] Implement statistical analysis service (glucose patterns, insulin effectiveness) in `apps/ai-service/app/services/analysis_service.py`
- [ ] T067 [US3] Implement confidence context generator and model-limitation warnings in `apps/ai-service/app/services/confidence_service.py`
- [ ] T068 [US3] Build insights dashboard screen with disclaimer-first layout in `apps/mobile/src/features/insights/screens/InsightsDashboardScreen.tsx`
- [ ] T069 [P] [US3] Build report detail screen with pattern findings and confidence indicators in `apps/mobile/src/features/insights/screens/ReportDetailScreen.tsx`
- [ ] T070 [US3] Write contract tests for AI service input/output schema (pytest) in `apps/ai-service/tests/test_analyze_contract.py`
- [ ] T071 [US3] Write integration test: AI service unavailable → Fastify returns 503 → core flows unaffected in `apps/api/tests/integration/insights-fallback.test.ts`

**Checkpoint**: Quickstart.md Cenário 3 passes. Disclaimer displayed before all insight content. AI outage does not affect insulin/symptom/alert flows.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, performance, security hardening, observability, and operational readiness across all stories.

- [ ] T072 [P] Run WCAG 2.1 AA automated accessibility audit on all critical screens (insulin log, symptom record, alert detail, emergency protocol) and fix violations in `apps/mobile/src/features/`
- [ ] T073 [P] Add accessibility manual validation checklist: touch targets ≥ 44px, minimum 16sp critical text, screen reader labels in `specs/001-sweetcare-fullstack-foundation/checklists/accessibility.md`
- [ ] T074 [P] Implement API versioning middleware with `Accept-Version` header support in `apps/api/src/infrastructure/http/versioning.plugin.ts`
- [ ] T075 [P] Implement request correlation ID propagation (Fastify → AI service → logs) in `apps/api/src/infrastructure/http/correlation.plugin.ts`
- [ ] T076 Performance benchmark: validate p95 ≤ 300ms on POST /v1/insulin-records, POST /v1/symptoms, GET /v1/patients/{id}/timeline per quickstart.md criteria; document results in `specs/001-sweetcare-fullstack-foundation/performance-baseline.md`
- [ ] T077 [P] Security hardening: verify all OWASP controls (rate limiting, CORS, HSTS, CSP, input validation, SQL injection guard via Prisma) in `apps/api/src/`
- [ ] T078 [P] Implement data retention policy: audit log retention config and LGPD right-to-erasure endpoint skeleton in `apps/api/src/presentation/routes/data-rights.routes.ts`
- [ ] T079 [P] Setup Prometheus metrics export (`/metrics`) and Grafana dashboard config in `infra/monitoring/`
- [ ] T080 [P] Validate Quickstart.md all three scenarios end-to-end on Docker Compose dev stack and document results

**Checkpoint**: All quickstart scenarios pass. Performance targets met. Accessibility audit clean. Security headers verified.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. All tasks [P] can run in parallel.
- **Phase 2 (Foundational)**: Requires Phase 1 completion. **BLOCKS all user story phases.**
- **Phase 3 (US1)**: Requires Phase 2. MVP — deliver independently.
- **Phase 4 (US2)**: Requires Phase 2. Can run in parallel with US1 if team capacity allows. Depends on SymptomRecord from US1.
- **Phase 5 (US3)**: Requires Phase 2. Consent flow depends on US1 patient profile creation. AI service is independent.
- **Phase 6 (Polish)**: Requires all desired user story phases complete.

### User Story Dependencies

- **US1 (P1)**: No inter-story dependencies. Pure foundation + implementation.
- **US2 (P2)**: Depends on `SymptomRecord` and `PatientProfile` from US1. Alert routes use the same auth/audit foundation.
- **US3 (P3)**: Depends on `PatientProfile` and existing records for data aggregation. AI service is fully independent.

### Within Each User Story

- Domain entities before repositories
- Repositories before application services
- Application services before route handlers
- API routes before mobile integration
- Integration tests after all layers complete

### Parallel Opportunities per Story

```bash
# US1 — parallel setup (after T031 deps met):
T030 InsulinRecord entity  ||  T031 SymptomRecord entity
T032 InsulinRecord repo    ||  T033 SymptomRecord repo
T046 Insulin log screen    ||  T047 Symptom record screen
T039 Insulin routes        ||  T040 Symptom routes

# US2 — all foundational tasks parallel:
T050 AlertEvent entity  ||  T053 AlertEvent repo
T055 Alert routes       ||  T056 Alert detail screen  ||  T057 Emergency screen

# US3 — parallel across API and AI service:
T065 FastAPI analyze endpoint  ||  T066 Analysis service  ||  T067 Confidence service
T068 Insights dashboard screen  ||  T069 Report detail screen
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (US1)
3. **Validate with Quickstart.md Cenário 1**
4. Deploy/demo: offline insulin logging + symptom recording + safe sync

### Incremental Delivery

1. **MVP**: Phases 1–3 → offline caregiving records + sync
2. **Safety layer**: Phase 4 (US2) → alerts + emergency guidance
3. **Intelligence layer**: Phase 5 (US3) → AI insights
4. **Production readiness**: Phase 6 → performance, accessibility, security

---

## Task Summary

| Phase                  | Tasks  | Parallel [P] | Story |
| ---------------------- | ------ | ------------ | ----- |
| Phase 1 — Setup        | 13     | 11           | —     |
| Phase 2 — Foundational | 16     | 10           | —     |
| Phase 3 — US1 (P1)     | 20     | 10           | US1   |
| Phase 4 — US2 (P2)     | 10     | 5            | US2   |
| Phase 5 — US3 (P3)     | 12     | 6            | US3   |
| Phase 6 — Polish       | 9      | 8            | —     |
| **Total**              | **80** | **50**       | —     |

---

## Notes

- `[P]` tasks can run concurrently — target different files and have no incomplete dependencies.
- All medical record entities are **immutable after creation** — no UPDATE or DELETE routes.
- PHI fields: never in logs, never in error responses, always encrypted at rest.
- LGPD consent gate enforced in Phase 2 foundation — all US phases inherit it.
- Run `quickstart.md` validation after each phase checkpoint before moving to next phase.
