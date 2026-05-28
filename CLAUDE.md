# SweetCare — Technical Reference

> **Este arquivo é a fonte de verdade técnica do projeto SweetCare.**
> Deve ser atualizado imediatamente após qualquer uma das seguintes ocorrências:
> criação, alteração ou remoção de funcionalidade · endpoint · integração · entidade de domínio ·
> componente crítico · decisão arquitetural · dependência · variável de ambiente ·
> política de segurança · correção de bug relevante · refatoração estrutural.
>
> Nunca deixe este arquivo desatualizado. Onboarding, auditoria e manutenção dependem dele.

---

## Índice

1. [Visão do Produto](#1-visão-do-produto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Estrutura do Monorepo](#3-estrutura-do-monorepo)
4. [Stack e Versões](#4-stack-e-versões)
5. [Modelo de Domínio](#5-modelo-de-domínio)
6. [Endpoints Implementados](#6-endpoints-implementados)
7. [Arquitetura de Segurança](#7-arquitetura-de-segurança)
8. [Setup de Desenvolvimento](#8-setup-de-desenvolvimento)
9. [Variáveis de Ambiente](#9-variáveis-de-ambiente)
10. [Testes](#10-testes)
11. [Progresso de Implementação](#11-progresso-de-implementação)
12. [Convenções e Padrões](#12-convenções-e-padrões)
13. [Gates da Constituição](#13-gates-da-constituição)
14. [Log de Mudanças Arquiteturais](#14-log-de-mudanças-arquiteturais)

---

## 1. Visão do Produto

**SweetCare** é uma plataforma mobile-first de suporte a cuidadores de crianças com Diabetes Mellitus Tipo 1 (T1DM). O sistema permite registro seguro de aplicações de insulina e sintomas, alertas de emergência baseados em regras, e insights assistidos por IA — incluindo operação offline com sincronização segura.

| Atributo             | Valor                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Domínio              | Saúde infantil — T1DM                                             |
| Usuários primários   | Responsáveis e cuidadores de crianças com T1DM                    |
| Criticidade          | Safety-critical — decisões afetam diretamente a saúde de crianças |
| Conformidade         | LGPD Art. 14 (dados de menores), OWASP Top 10, WCAG 2.1 AA        |
| Constituição técnica | `.specify/memory/constitution.md` v1.0.0                          |
| Spec de fundação     | `specs/001-sweetcare-fullstack-foundation/`                       |

---

## 2. Arquitetura do Sistema

### Topologia de serviços

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile Client (Expo / React Native)                            │
│  • Expo Router v4 — file-based navigation                       │
│  • React Query — server state + offline mutation queue          │
│  • SQLite (SQLCipher) — offline PHI storage, criptografado      │
│  • expo-secure-store — tokens (iOS Keychain / Android Keystore) │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / TLS 1.3
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (Fastify 5 / TypeScript — apps/api)                        │
│  • Zod type provider — schema-first validation                  │
│  • @fastify/jwt — access tokens (15 min)                        │
│  • @fastify/cookie — refresh tokens HttpOnly                    │
│  • Prisma 6 + PHI encryption extension                          │
│  • Pino — structured logging com redação de PHI                 │
└──────────┬──────────────────────────┬───────────────────────────┘
           │ PostgreSQL               │ HTTP (rede interna)
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────────────────┐
│  PostgreSQL 16   │      │  AI Service (FastAPI / Python 3.12)  │
│  • pgcrypto ext  │      │  • Rede interna — não exposta        │
│  • RLS policies  │      │  • Recebe apenas métricas agregadas  │
│  • Triggers      │      │  • Nunca recebe PHI bruto            │
│  imutabilidade   │      └──────────────────────────────────────┘
│  • pgaudit       │
└──────────────────┘
         │
┌────────┴─────────┐
│  Redis 7         │
│  • Session cache │
│  • Rate limiting │
└──────────────────┘
```

### Princípios arquiteturais

| Princípio                  | Implementação                                                      |
| -------------------------- | ------------------------------------------------------------------ |
| **Safety-critical first**  | Registros médicos imutáveis; falha-segura em fluxos de emergência  |
| **Defense-in-depth**       | TLS → RBAC → RLS → encryption middleware → audit trail             |
| **PHI zero-trust em logs** | Pino redaction — IDs de correlação apenas, sem dados clínicos      |
| **Offline-first**          | SQLite + React Query `persistQueryClient` + sync idempotente       |
| **AI isolado**             | FastAPI recebe apenas métricas agregadas; proxy Fastify remove PHI |
| **Imutabilidade**          | Triggers PostgreSQL bloqueiam UPDATE/DELETE em registros médicos   |

---

## 3. Estrutura do Monorepo

```
sweetcare-app/
├── CLAUDE.md                          ← este arquivo (atualização obrigatória)
├── pnpm-workspace.yaml                ← workspaces: apps/* + packages/*
├── package.json                       ← root: turbo scripts + lint-staged + husky
├── turbo.json                         ← pipeline: build → test → lint → typecheck
├── tsconfig.base.json                 ← TypeScript 5 strict + noUncheckedIndexedAccess
├── eslint.config.mjs                  ← ESLint v9 flat + @typescript-eslint/strict
├── .prettierrc.json                   ← Prettier 3 (LF, 100 cols)
├── .husky/pre-commit                  ← → pnpm lint-staged
│
├── packages/
│   ├── shared-types/                  ← Tipos de domínio TypeScript (sem deps de runtime)
│   │   └── src/domain/
│   │       ├── auth.types.ts          ← User, ConsentRecord, JwtPayload, AuthTokens
│   │       ├── medical-records.types.ts ← InsulinRecord, SymptomRecord, AlertEvent, Timeline
│   │       ├── sync.types.ts          ← SyncConflict, OfflineRecord, SyncBatchResult
│   │       └── insights.types.ts      ← InsightReport, PatternFinding, ConfidenceContext
│   │
│   ├── shared-validation/             ← Schemas Zod compartilhados (API + mobile)
│   │   └── src/schemas/
│   │       ├── auth.schemas.ts        ← register, login, consent, MFA
│   │       ├── medical-records.schemas.ts ← createPatient, createInsulin, createSymptom
│   │       └── sync.schemas.ts        ← syncBatch (max 100), resolveConflict
│   │
│   └── shared-config/                 ← Env schemas Zod + constantes de domínio
│       └── src/
│           ├── env.schema.ts          ← ApiEnv + AiServiceEnv (falha rápido na inicialização)
│           └── constants.ts           ← limites de dose, bounds de glicose, TTLs, LGPD
│
├── apps/
│   ├── api/                           ← Fastify 5 + TypeScript
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← 11 entidades, 13 enums, índices e relações
│   │   │   └── manual/
│   │   │       └── rls-policies.sql   ← RLS + triggers de imutabilidade + has_patient_access()
│   │   ├── src/
│   │   │   ├── server.ts              ← Entry point: graceful shutdown SIGTERM/SIGINT
│   │   │   ├── app.ts                 ← Factory: plugins + rotas + error handler PHI-safe
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── insulin-application-record.entity.ts ← validateInsulinRecord (dose, glucose, timestamp)
│   │   │   │   │   ├── symptom-record.entity.ts             ← validateSymptomRecord + computeMinimumSeverity
│   │   │   │   │   ├── alert-event.entity.ts                ← ALERT_GUIDANCE map, GUIDANCE_SUMMARY, GuidanceKey
│   │   │   │   │   └── insight-report.entity.ts             ← validateReportPeriod, CLINICAL_DISCLAIMER_V1, MAX_PERIOD_DAYS
│   │   │   │   └── services/
│   │   │   │       ├── caregiver-access.guard.ts            ← checkPatientAccess, hasActiveConsent(consentType?), isReadOnly
│   │   │   │       └── alert-rule-engine.ts                 ← evaluateAlertRules (pure, 5 rules, priority order)
│   │   │   ├── application/
│   │   │   │   ├── audit/
│   │   │   │   │   └── audit.service.ts    ← Append-only; nunca expõe UPDATE/DELETE
│   │   │   │   ├── auth/
│   │   │   │   │   └── auth.service.ts     ← register, login, refresh, logout, grantConsent
│   │   │   │   └── services/
│   │   │   │       ├── insulin-record.service.ts      ← createInsulinRecord, listInsulinRecords
│   │   │   │       ├── symptom-record.service.ts      ← createSymptomRecord, listSymptomRecords (dispara alerta)
│   │   │   │       ├── sync-batch.service.ts          ← processSyncBatch, getSyncStatus, resolveConflict
│   │   │   │       └── insight-aggregation.service.ts ← aggregatePatientData (strip PHI → AggregatedRecord[])
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   └── ai-service-client.ts  ← callAnalyze (30s timeout + circuit breaker 3/30s)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── jwt.plugin.ts       ← authenticate + requireRole decorators
│   │   │   │   │   ├── password.service.ts ← argon2id (64MB, 3 iter, parallelism=1)
│   │   │   │   │   ├── rbac.middleware.ts  ← requirePatientAccess, requireWriteAccess
│   │   │   │   │   └── session.repository.ts ← family invalidation + theft detection
│   │   │   │   ├── database/
│   │   │   │   │   ├── client.ts           ← Prisma singleton + circuit breaker + PHI ext
│   │   │   │   │   └── encryption-middleware.ts ← AES-256-GCM por campo PHI
│   │   │   │   ├── http/
│   │   │   │   │   └── security-plugins.ts ← helmet + cors + rate-limit
│   │   │   │   ├── logging/
│   │   │   │   │   └── logger.ts           ← Pino com 15 paths de redação PHI
│   │   │   │   ├── notifications/
│   │   │   │   │   └── push-notification.service.ts ← sendAlertNotification (PHI-free stub; FCM/APNs Phase 6)
│   │   │   │   └── repositories/
│   │   │   │       ├── insulin-record.repository.ts    ← upsertInsulinRecord, getPatientInsulinRecords, findBolusRecordsInWindow
│   │   │   │       ├── symptom-record.repository.ts    ← upsertSymptomRecord, getPatientSymptomRecords
│   │   │   │       ├── alert-event.repository.ts       ← createAlertEvent, getPatientAlerts, resolveAlert
│   │   │   │       └── insight-report.repository.ts    ← createInsightReport, getReportById, listPatientReports, updateReportCompleted/Failed
│   │   │   └── presentation/routes/
│   │   │       ├── health.routes.ts        ← GET /health + GET /ready
│   │   │       ├── auth.routes.ts          ← register, login, refresh, logout, MFA stub
│   │   │       ├── consent.routes.ts       ← POST /consent, DELETE /consent/:id
│   │   │       ├── patients.routes.ts      ← POST /patients, GET /patients/:id
│   │   │       ├── insulin-records.routes.ts ← POST+GET /patients/:id/insulin-records
│   │   │       ├── symptom-records.routes.ts ← POST+GET /patients/:id/symptoms
│   │   │       ├── sync.routes.ts          ← POST /sync/batch, GET /sync/status/:id, POST /sync/resolve-conflict
│   │   │       ├── timeline.routes.ts      ← GET /patients/:id/timeline (insulin+symptom merged)
│   │   │       ├── alerts.routes.ts        ← GET /patients/:id/alerts, GET /alerts/:id, PATCH /alerts/:id/resolve
│   │   │       └── insights.routes.ts      ← POST /insights/reports (202), GET /insights/reports/:id, GET /insights/reports
│   │   └── tests/
│   │       ├── setup.ts               ← env vars de test + crypto stub
│   │       └── integration/
│   │           ├── auth-flow.test.ts         ← health, register, auth guards
│   │           ├── sync-flow.test.ts         ← Phase 3 route guards + validation
│   │           ├── alert-flow.test.ts        ← Phase 4 route guards + alert rule engine (9 casos)
│   │           └── insights-fallback.test.ts ← Phase 5 route guards + period validation (8 casos)
│   │
│   ├── mobile/                        ← Expo SDK 52 + React Native 0.76
│   │   ├── app.json                   ← Bundle IDs, plugins: expo-router, expo-secure-store, expo-sqlite
│   │   ├── app/
│   │   │   ├── _layout.tsx            ← QueryClient + Stack (emergency = fullScreenModal)
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx        ← Tab nav com touch targets ≥ 56pt (acessibilidade)
│   │   │       └── index.tsx          ← Tela inicial (stub — US1 implementa timeline)
│   │   └── src/
│   │       ├── design/
│   │       │   └── DESIGN_SYSTEM.md   ← Paleta, tipografia, espaçamento, componentes, acessibilidade
│   │       ├── features/
│   │       │   ├── insulin/screens/
│   │       │   │   └── InsulinLogScreen.tsx      ← react-hook-form + Zod, offline fallback
│   │       │   ├── symptoms/screens/
│   │       │   │   └── SymptomRecordScreen.tsx   ← chip picker, severity auto-compute, emergência banner
│   │       │   ├── sync/components/
│   │       │   │   └── SyncStatusBar.tsx         ← pending count, sync trigger, conflict badge
│   │       │   └── insights/screens/
│   │       │       ├── InsightsDashboardScreen.tsx ← lista relatórios, solicita novo, polling status, disclaimer-first
│   │       │       └── ReportDetailScreen.tsx      ← disclaimer + summary + findings + confidence indicators
│   │       └── infrastructure/
│   │           ├── storage/
│   │           │   ├── secure-storage.ts  ← Tokens: iOS Keychain / Android Keystore (nunca AsyncStorage)
│   │           │   └── offline-db.ts      ← SQLite: insulin + symptom offline + sync_queue
│   │           └── sync/
│   │               ├── offline-queue.ts   ← queueInsulinRecord/queueSymptomRecord com fallback SQLite
│   │               └── sync-engine.ts     ← runSync + useSyncEngine (AppState foreground trigger)
│   │
│   └── ai-service/                    ← FastAPI 0.115 + Python 3.12
│       ├── pyproject.toml             ← uv + ruff + mypy strict + pytest
│       ├── Dockerfile.dev             ← uv + uvicorn --reload
│       ├── tests/
│       │   └── test_analyze_contract.py ← contrato /v1/analyze: schema, PHI isolation, finding rules
│       └── app/
│           ├── main.py                ← Middleware: bloqueia acesso direto (X-Internal-Request-Id); registra router /v1
│           ├── api/
│           │   └── analyze.py         ← POST /v1/analyze (FastAPI, roteador interno)
│           ├── schemas/
│           │   └── analyze.py         ← AnalyzeRequest, AnalyzeResponse, PatternFinding, ConfidenceContext (Pydantic)
│           └── services/
│               ├── analysis_service.py   ← analyze_records (5 detectores estatísticos, suprime < 3 data points)
│               └── confidence_service.py ← compute_confidence_context, compute_finding_confidence, MODEL_VERSION
│
└── infra/
    ├── docker/
    │   ├── compose.dev.yml            ← postgres:16, redis:7, ai-service (rede interna isolada)
    │   └── postgres/
    │       └── init.sql               ← pgcrypto + uuid-ossp + pg_trgm
    └── .github/workflows/
        └── ci.yml                     ← typescript · api-test · ai-service · security · constitution
```

---

## 4. Stack e Versões

### Backend (apps/api)

| Tecnologia                  | Versão | Propósito                          |
| --------------------------- | ------ | ---------------------------------- |
| Node.js                     | 20 LTS | Runtime                            |
| TypeScript                  | 5.7    | Linguagem                          |
| Fastify                     | 5.2    | HTTP framework                     |
| `fastify-type-provider-zod` | 4.0    | Schema-first validation            |
| `@fastify/jwt`              | 9.0    | Access tokens JWT HS256            |
| `@fastify/cookie`           | 11.0   | Refresh token HttpOnly cookie      |
| `@fastify/helmet`           | 13.0   | HTTP security headers              |
| `@fastify/cors`             | 10.0   | CORS controlado por allowlist      |
| `@fastify/rate-limit`       | 10.1   | Proteção contra abuso              |
| `fastify-plugin`            | 5.0    | Plugin encapsulation               |
| Prisma                      | 6.1    | ORM + type-safe migrations         |
| PostgreSQL                  | 16     | Banco principal + pgcrypto + RLS   |
| Redis                       | 7      | Session cache + rate limiting      |
| Zod                         | 3.23   | Validação de schema                |
| Pino                        | 9.5    | Structured logging + PHI redaction |
| argon2                      | 0.41   | Password hashing (argon2id)        |

### Mobile (apps/mobile)

| Tecnologia                  | Versão | Propósito                        |
| --------------------------- | ------ | -------------------------------- |
| React Native                | 0.76   | Framework mobile                 |
| Expo SDK                    | 52     | Build + APIs nativas             |
| Expo Router                 | 4.0    | File-based navigation            |
| `expo-secure-store`         | 14.0   | Tokens (Keychain/Keystore)       |
| `expo-sqlite`               | 15.1   | Offline DB (SQLCipher build)     |
| `expo-local-authentication` | 15.0   | Biometria para unlock            |
| `@tanstack/react-query`     | 5.62   | Server state + offline mutations |
| `react-hook-form`           | 7.54   | Formulários validados            |
| Zod                         | 3.23   | Validação compartilhada          |

### AI Service (apps/ai-service)

| Tecnologia   | Versão | Propósito              |
| ------------ | ------ | ---------------------- |
| Python       | 3.12   | Runtime                |
| FastAPI      | 0.115  | HTTP framework         |
| Pydantic     | 2.10   | Validação e schemas    |
| uvicorn      | 0.34   | ASGI server            |
| NumPy        | 2.2    | Análise numérica       |
| pandas       | 2.2    | Agregação de dados     |
| scikit-learn | 1.6    | Análise de padrões     |
| structlog    | 24.4   | Structured logging     |
| ruff         | 0.8    | Linting + formatting   |
| mypy         | 1.13   | Type checking (strict) |

### Tooling (root)

| Tecnologia     | Versão | Propósito                   |
| -------------- | ------ | --------------------------- |
| pnpm           | 9.15   | Package manager             |
| Turborepo      | 2.3    | Build orchestration + cache |
| ESLint         | 9.17   | Linting (flat config)       |
| Prettier       | 3.4    | Formatting                  |
| Husky          | 9.1    | Git hooks                   |
| lint-staged    | 15.2   | Pre-commit checks           |
| Vitest         | 2.1    | Test runner (API + shared)  |
| pytest         | 8.3    | Test runner (AI service)    |
| GitHub Actions | —      | CI/CD                       |

---

## 5. Modelo de Domínio

### Entidades e responsabilidades

| Entidade                   | Tabela                        | Mutável                       | Campos PHI cifrados                                |
| -------------------------- | ----------------------------- | ----------------------------- | -------------------------------------------------- |
| `User`                     | `users`                       | Sim                           | `displayName`, `phoneE164`, `mfaSecretEnc`         |
| `ConsentRecord`            | `consent_records`             | Não (revogação apenas)        | —                                                  |
| `PatientProfile`           | `patient_profiles`            | Sim                           | `fullName`, `insulinTypeBasal`, `insulinTypeBolus` |
| `CaregiverAssignment`      | `caregiver_assignments`       | Não (revogação apenas)        | —                                                  |
| `InsulinApplicationRecord` | `insulin_application_records` | **Imutável**                  | `insulinType`, `glucoseBeforeMgdl`, `notes`        |
| `SymptomRecord`            | `symptom_records`             | **Imutável**                  | `glucoseReadingMgdl`, `notes`                      |
| `AlertEvent`               | `alert_events`                | Parcial (apenas `resolvedAt`) | —                                                  |
| `SyncEvent`                | `sync_events`                 | Não                           | `conflictDetails` (app layer)                      |
| `AuditEntry`               | `audit_entries`               | **Imutável**                  | —                                                  |
| `InsightReport`            | `insight_reports`             | Não                           | `summaryText`, `patternFindings`                   |
| `UserSession`              | `user_sessions`               | Parcial (revogação)           | —                                                  |

### Invariantes críticas de domínio

```
dose_units: 0.01 ≤ x ≤ 100            (InsulinApplicationRecord)
target_glucose: min < max              (PatientProfile)
glucose_*_mgdl: 20 ≤ x ≤ 600          (todos os campos de glicemia)
applied_at/observed_at: ≤ now + 5min  (sem registros no futuro)
severity=emergency → alerta síncrono  (SymptomRecord → AlertEvent na mesma TX)
client_id: UUIDv7 único por record     (garantia de idempotência)
```

### Relações chave

```
User (guardian) ──< CaregiverAssignment >── PatientProfile
User (guardian) ──< ConsentRecord ──────── PatientProfile
PatientProfile  ──< InsulinApplicationRecord ── AuditEntry
PatientProfile  ──< SymptomRecord ──────────── AlertEvent ── AuditEntry
User            ──< UserSession   (família de tokens / family invalidation)
```

---

## 6. Endpoints Implementados

> Prefixo: `/api/v1` · Formato: JSON · Correlação: header `X-Request-Id`

### Autenticação e Sessão

| Método | Rota                  | Auth                      | Status          |
| ------ | --------------------- | ------------------------- | --------------- |
| POST   | `/auth/register`      | —                         | ✅ Implementado |
| POST   | `/auth/login`         | —                         | ✅ Implementado |
| POST   | `/auth/refresh`       | Cookie `sc_refresh_token` | ✅ Implementado |
| POST   | `/auth/logout`        | Bearer                    | ✅ Implementado |
| POST   | `/auth/mfa/verify`    | —                         | 🔲 Stub (501)   |
| POST   | `/consent`            | Bearer                    | ✅ Implementado |
| DELETE | `/consent/:consentId` | Bearer                    | ✅ Implementado |

### Operações

| Método | Rota      | Auth | Status                          |
| ------ | --------- | ---- | ------------------------------- |
| GET    | `/health` | —    | ✅ Implementado                 |
| GET    | `/ready`  | —    | ✅ Implementado (stub DB check) |

### Phase 3 (US1) — Registros offline + sync

| Método | Rota                            | Auth                         | Status          |
| ------ | ------------------------------- | ---------------------------- | --------------- |
| POST   | `/patients`                     | Bearer (guardian)            | ✅ Implementado |
| GET    | `/patients/:id`                 | Bearer + CaregiverAssignment | ✅ Implementado |
| POST   | `/patients/:id/insulin-records` | Bearer + write access        | ✅ Implementado |
| GET    | `/patients/:id/insulin-records` | Bearer + CaregiverAssignment | ✅ Implementado |
| POST   | `/patients/:id/symptoms`        | Bearer + write access        | ✅ Implementado |
| GET    | `/patients/:id/symptoms`        | Bearer + CaregiverAssignment | ✅ Implementado |
| POST   | `/sync/batch`                   | Bearer                       | ✅ Implementado |
| GET    | `/sync/status/:patientId`       | Bearer + CaregiverAssignment | ✅ Implementado |
| POST   | `/sync/resolve-conflict`        | Bearer                       | ✅ Implementado |
| GET    | `/patients/:id/timeline`        | Bearer + CaregiverAssignment | ✅ Implementado |

### Phase 4 (US2) — Alertas

| Método | Rota                   | Auth                         | Status          |
| ------ | ---------------------- | ---------------------------- | --------------- |
| GET    | `/patients/:id/alerts` | Bearer + CaregiverAssignment | ✅ Implementado |
| GET    | `/alerts/:id`          | Bearer + CaregiverAssignment | ✅ Implementado |
| PATCH  | `/alerts/:id/resolve`  | Bearer + CaregiverAssignment | ✅ Implementado |

### Phase 5 (US3) — AI Insights

| Método | Rota                    | Auth                                                 | Status                      |
| ------ | ----------------------- | ---------------------------------------------------- | --------------------------- |
| POST   | `/insights/reports`     | Bearer + CaregiverAssignment + `ai_analysis` consent | ✅ Implementado (202 async) |
| GET    | `/insights/reports/:id` | Bearer + CaregiverAssignment                         | ✅ Implementado             |
| GET    | `/insights/reports`     | Bearer + CaregiverAssignment                         | ✅ Implementado             |

> Fluxo: POST → 202 + fire-and-forget → AI service `/v1/analyze` → `updateReportCompleted/Failed`.
> Polling via GET até `status = completed | failed`. Requer consentimento `ai_analysis` ativo.

---

## 7. Arquitetura de Segurança

### Decisão: Defense-in-Depth para dados de saúde de crianças (LGPD Art. 14)

#### Camadas de proteção

| Camada             | Controle                                                                       | Arquivo                         |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------- |
| Transporte         | TLS 1.3 mínimo (nginx/Caddy reverse proxy)                                     | `infra/docker/`                 |
| HTTP               | HSTS 2 anos + CSP completo (frameAncestors, formAction, etc.) + bodyLimit 1 MB | `security-plugins.ts`, `app.ts` |
| Autenticação       | JWT HS256 15min + refresh 7d com family invalidation                           | `jwt.plugin.ts`                 |
| Senha              | argon2id — 64MB, 3 iterações, parallelism=1                                    | `password.service.ts`           |
| Sessão             | Detecção de roubo por reutilização de token rotacionado                        | `session.repository.ts`         |
| Autorização        | RBAC (4 papéis) + verificação de `CaregiverAssignment`                         | `rbac.middleware.ts`            |
| Banco (app layer)  | AES-256-GCM por campo PHI via Prisma `$extends`                                | `encryption-middleware.ts`      |
| Banco (DB layer)   | Row Level Security — `has_patient_access()` por sessão                         | `rls-policies.sql`              |
| Imutabilidade      | Triggers `BEFORE UPDATE OR DELETE` em tabelas médicas                          | `rls-policies.sql`              |
| Logging            | Pino — 15 paths PHI redatados, correlação por UUID                             | `logger.ts`                     |
| Auditoria          | Append-only `audit_entries` — sem UPDATE/DELETE                                | `audit.service.ts`              |
| Mobile             | `expo-secure-store` (Keychain/Keystore) — nunca `AsyncStorage`                 | `secure-storage.ts`             |
| Mobile offline     | SQLite com SQLCipher — criptografia de dispositivo                             | `offline-db.ts`                 |
| Push notifications | Payload sem PHI — app busca conteúdo via API após receber                      | `contracts/api-alerts.md`       |

#### Conformidade LGPD Art. 14

| Requisito                    | Implementação                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Consentimento do responsável | `ConsentRecord` com `data_processing` obrigatório antes de criar `PatientProfile` |
| Revogação                    | `DELETE /consent/:id` — freeze de processamento de dados                          |
| Minimização                  | Somente campos clinicamente necessários coletados                                 |
| Direito de acesso            | Planejado: `GET /users/me/data-export` (Phase 6 — T078)                           |
| Direito à exclusão           | Planejado: `DELETE /users/me` + `data-rights.routes.ts` (Phase 6 — T078)          |
| Notificação de violação      | Runbook documentado em `specs/.../research.md`                                    |

#### Papéis e permissões

| Papel                     | Descrição              | Pode criar registro |                       Pode ler |
| ------------------------- | ---------------------- | ------------------- | -----------------------------: |
| `guardian`                | Responsável legal      | Sim                 |  Todos os pacientes atribuídos |
| `caregiver`               | Cuidador delegado      | Sim                 | Pacientes com assignment ativo |
| `read_only`               | Acesso somente leitura | Não                 | Pacientes com assignment ativo |
| `healthcare_professional` | Profissional de saúde  | Não (v1)            |      Futuro: acesso controlado |
| `admin`                   | Administração interna  | —                   |       Bypassa RLS via SET ROLE |

#### Circuit breaker — banco de dados

```
Estado: closed → open → half-open → closed
Threshold: 5 falhas consecutivas
Recovery timeout: 30 segundos
Probe: primeira requisição após timeout
```

---

## 8. Setup de Desenvolvimento

### Pré-requisitos

- Node.js 20 LTS
- pnpm 9.x (`npm install -g pnpm`)
- Docker Desktop (PostgreSQL + Redis + AI service)
- Python 3.12 + uv (para AI service)

### Inicialização completa

```bash
# 1. Instalar dependências do monorepo
pnpm install

# 2. Configurar variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/ai-service/.env.example apps/ai-service/.env
# Editar apps/api/.env: DATABASE_URL, JWT_*_SECRET, PHI_ENCRYPTION_KEY

# 3. Subir infraestrutura local
docker compose -f infra/docker/compose.dev.yml up -d

# 4. Gerar Prisma client e rodar migrations
pnpm --filter "@sweetcare/api" db:generate
pnpm --filter "@sweetcare/api" db:migrate

# 5. Aplicar políticas de segurança no banco
psql $DATABASE_URL -f apps/api/prisma/manual/rls-policies.sql

# 6. Build dos packages compartilhados
pnpm --filter "@sweetcare/shared-*" build

# 7. Iniciar API em modo desenvolvimento
pnpm --filter "@sweetcare/api" dev

# 8. Iniciar mobile (emulador/dispositivo conectado)
pnpm --filter "@sweetcare/mobile" start
```

### Gerar PHI_ENCRYPTION_KEY e JWT secrets

```bash
# PHI_ENCRYPTION_KEY (32 bytes = 64 hex chars)
openssl rand -hex 32

# JWT_ACCESS_SECRET e JWT_REFRESH_SECRET (valores diferentes!)
openssl rand -hex 32
openssl rand -hex 32
```

### Comandos frequentes

```bash
pnpm build               # Build todos os packages e apps
pnpm test                # Testes de todos os packages
pnpm lint                # ESLint em todo o monorepo
pnpm typecheck           # TypeScript em todo o monorepo
pnpm format              # Prettier em todos os arquivos

# API
pnpm --filter "@sweetcare/api" dev          # Dev server com hot-reload
pnpm --filter "@sweetcare/api" db:studio   # Prisma Studio (localhost:5555)
pnpm --filter "@sweetcare/api" test:coverage

# Mobile
pnpm --filter "@sweetcare/mobile" android  # Build + run Android
pnpm --filter "@sweetcare/mobile" ios      # Build + run iOS

# Docker
docker compose -f infra/docker/compose.dev.yml up -d      # Subir tudo
docker compose -f infra/docker/compose.dev.yml down -v    # Limpar volumes
docker compose -f infra/docker/compose.dev.yml logs -f    # Logs
```

---

## 9. Variáveis de Ambiente

### `apps/api/.env`

| Variável                     | Obrigatório                 | Descrição                                                    |
| ---------------------------- | --------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                   | Sim                         | `development` \| `test` \| `production`                      |
| `PORT`                       | Não (padrão 3000)           | Porta HTTP                                                   |
| `HOST`                       | Não (padrão 0.0.0.0)        | Bind host                                                    |
| `DATABASE_URL`               | **Sim**                     | Connection string PostgreSQL                                 |
| `DATABASE_POOL_MIN`          | Não (padrão 2)              | Conexões mínimas no pool                                     |
| `DATABASE_POOL_MAX`          | Não (padrão 10)             | Conexões máximas no pool                                     |
| `JWT_ACCESS_SECRET`          | **Sim**                     | Segredo JWT (mín. 32 chars)                                  |
| `JWT_REFRESH_SECRET`         | **Sim**                     | Segredo refresh token (mín. 32 chars, diferente do access)   |
| `JWT_ACCESS_EXPIRY_SECONDS`  | Não (padrão 900)            | Expiração do access token                                    |
| `JWT_REFRESH_EXPIRY_SECONDS` | Não (padrão 604800)         | Expiração do refresh token                                   |
| `PHI_ENCRYPTION_KEY`         | **Sim**                     | 64 hex chars (32 bytes) para AES-256-GCM                     |
| `REDIS_URL`                  | **Sim**                     | Connection string Redis                                      |
| `AI_SERVICE_URL`             | Não (padrão localhost:8000) | URL interna do AI service                                    |
| `AI_SERVICE_TIMEOUT_MS`      | Não (padrão 30000)          | Timeout para AI service                                      |
| `CORS_ALLOWED_ORIGINS`       | Não                         | Origens CORS separadas por vírgula                           |
| `LOG_LEVEL`                  | Não (padrão info)           | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |

> ⚠️ `PHI_ENCRYPTION_KEY`: perda desta chave = perda permanente de todos os dados PHI cifrados.
> Em produção, use AWS Secrets Manager ou HashiCorp Vault com rotação documentada.

### `apps/mobile/.env.local`

| Variável              | Descrição                                                   |
| --------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | URL base da API (ex: `https://api.sweetcare.com.br/api/v1`) |
| `EXPO_PUBLIC_ENV`     | `development` \| `staging` \| `production`                  |

### `apps/ai-service/.env`

| Variável                | Descrição                                              |
| ----------------------- | ------------------------------------------------------ |
| `PORT`                  | Porta interna (padrão 8000)                            |
| `ALLOWED_INTERNAL_HOST` | Hostname do serviço API que pode chamar (padrão `api`) |
| `LOG_LEVEL`             | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR`              |
| `ENVIRONMENT`           | `development` \| `production`                          |

---

## 10. Testes

### Estratégia por camada

| Camada                | Framework          | Localização                   | Status                                                             |
| --------------------- | ------------------ | ----------------------------- | ------------------------------------------------------------------ |
| API — unit            | Vitest             | `apps/api/tests/unit/`        | 🔲 Planejado Phase 3+                                              |
| API — integração      | Vitest             | `apps/api/tests/integration/` | ✅ auth-flow, sync-flow, alert-flow, insights-fallback (46 testes) |
| Mobile — componentes  | Vitest + RNTL      | `apps/mobile/tests/`          | 🔲 Planejado Phase 3+                                              |
| AI service — contrato | pytest             | `apps/ai-service/tests/`      | ✅ test_analyze_contract.py (13 casos)                             |
| E2E mobile            | Detox              | `apps/mobile/e2e/`            | 🔲 Planejado Phase 6                                               |
| Acessibilidade        | Automated + manual | Screens críticas              | 🔲 Planejado Phase 6                                               |

### Executar testes

```bash
# Todos os testes
pnpm test

# API com cobertura (threshold: 80%)
pnpm --filter "@sweetcare/api" test:coverage

# AI service
cd apps/ai-service && pytest

# Watch mode durante desenvolvimento
pnpm --filter "@sweetcare/api" test:watch
```

### Ambiente de teste para API

O arquivo `apps/api/tests/setup.ts` configura variáveis de ambiente mock.
Para testes de integração completos com banco real, use:

```bash
# Banco de teste separado (não usar o de desenvolvimento)
DATABASE_URL=postgresql://sweetcare:test@localhost:5432/sweetcare_test pnpm --filter "@sweetcare/api" test
```

---

## 11. Progresso de Implementação

### Visão geral

| Phase                                  | Tarefas | Concluídas | %       |
| -------------------------------------- | ------- | ---------- | ------- |
| Phase 1 — Setup                        | 13      | 13         | 100% ✅ |
| Phase 2 — Foundation                   | 16      | 16         | 100% ✅ |
| Phase 3 — US1 (offline records + sync) | 20      | 20         | 100% ✅ |
| Phase 4 — US2 (alerts)                 | 10      | 10         | 100% ✅ |
| Phase 5 — US3 (AI insights)            | 12      | 12         | 100% ✅ |
| Phase 6 — Polish                       | 9       | 1          | 11% 🔄  |
| **Total**                              | **80**  | **72**     | **90%** |

> Rastreamento detalhado em `specs/001-sweetcare-fullstack-foundation/tasks.md`

### Próximas tarefas desbloqueadas (Phase 6 — Polish)

| Task | Descrição                                                                   | Prioridade |
| ---- | --------------------------------------------------------------------------- | ---------- |
| T072 | Auditoria de acessibilidade WCAG 2.1 AA em telas críticas                   | P1         |
| T074 | Middleware de versionamento de API (`Accept-Version`)                       | P2         |
| T075 | Propagação de correlation ID (Fastify → AI service → logs)                  | P2         |
| T076 | Benchmark de performance: p95 ≤ 300ms nos endpoints críticos                | P2         |
| T077 | ~~Hardening de segurança: verificação OWASP Top 10~~ ✅ Concluído           | P1         |
| T078 | Endpoint de direitos LGPD: `GET /users/me/data-export` + `DELETE /users/me` | P1         |

---

## 12. Convenções e Padrões

### TypeScript (API)

```typescript
// ✅ Imports de tipo separados
import type { FastifyInstance } from "fastify";

// ✅ Exports explícitos de tipo
export type PlainRecord = Record<string, unknown>;

// ✅ Prefer readonly em parâmetros de domínio
function process(record: Readonly<InsulinRecord>): void;

// ✅ Async/await — nunca callbacks
// ✅ noUncheckedIndexedAccess: sempre verificar índices de array
// ✅ exactOptionalPropertyTypes: sem omissões implícitas de propriedades opcionais

// ❌ Nunca any — use unknown e narrowing
// ❌ Nunca console.log — use app.log ou logger
// ❌ Nunca AsyncStorage para dados de saúde no mobile
// ❌ Nunca PHI em mensagens de erro retornadas ao cliente
```

### Estrutura de camadas (API)

```
Presentation (routes) → Application (services) → Domain (entities) → Infrastructure (repos, DB, auth)
```

- Rotas: apenas validação de entrada/saída e delegação ao service
- Services: lógica de negócio, orquestração, auditoria
- Entities: invariantes de domínio, regras de negócio puras
- Infrastructure: Prisma, argon2, JWT, sessions, AWS — sem lógica de negócio

### Nomenclatura

| Elemento            | Convenção                          | Exemplo                        |
| ------------------- | ---------------------------------- | ------------------------------ |
| Arquivos TypeScript | `kebab-case.ts`                    | `insulin-record.service.ts`    |
| Classes/tipos       | `PascalCase`                       | `InsulinApplicationRecord`     |
| Funções/variáveis   | `camelCase`                        | `createSession()`              |
| Constantes          | `UPPER_SNAKE`                      | `DOSE_MAX_UNITS`               |
| Rotas HTTP          | `kebab-case`                       | `/insulin-records`             |
| Tabelas PostgreSQL  | `snake_case`                       | `insulin_application_records`  |
| Colunas Prisma      | `camelCase` + `@map("snake_case")` | `doseUnits @map("dose_units")` |
| Arquivos Python     | `snake_case.py`                    | `analysis_service.py`          |

### Comentários

Apenas para "por quê não óbvio":

- Restrições ocultas ou invariantes críticas
- Workarounds para comportamento surpreendente de lib/sistema
- Decisões de segurança que precisam de contexto

**Nunca** comentar o que o código já diz, tarefas atuais, ou referências a issues/PRs.

### Commits

```
tipo(escopo): descrição em inglês

# Tipos: feat, fix, security, refactor, test, docs, chore, perf
# Escopo: api, mobile, ai-service, shared-types, shared-validation, infra, deps

feat(api): implement JWT refresh token family invalidation
security(api): add argon2id password hashing with OWASP parameters
fix(mobile): prevent AsyncStorage use for PHI fields
```

---

## 13. Gates da Constituição

Todo PR deve passar pelos 6 gates antes do merge (`.specify/memory/constitution.md` v1.0.0):

| Gate                           | Critérios obrigatórios                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **1. Arquitetura**             | Limites limpos entre domain/application/infrastructure/presentation          |
| **2. Segurança**               | Ameaças mapeadas; secrets seguros; auth/authz verificados; logs PHI-safe     |
| **3. Testes**                  | Cobertura para caminhos críticos; testes de failure mode para fluxos médicos |
| **4. UX/Acessibilidade**       | WCAG 2.1 AA; touch targets ≥ 44pt; textos ≥ 16sp em alertas; screen reader   |
| **5. Performance/Resiliência** | p95 ≤ 300ms em endpoints críticos; comportamento offline validado            |
| **6. Review**                  | Revisão de risco, manutenibilidade e backward compatibility                  |

> Mudanças em fluxos safety-critical ou no modelo de dados requerem aprovação manual + estratégia de rollback verificável.

---

## 14. Log de Mudanças Arquiteturais

> Registrar aqui decisões não óbvias, reversões de abordagem, e mudanças com impacto largo.
> Não duplicar o que já está em git log — apenas o "por quê" que não aparece no código.

### 2026-05-27 — Fundação do projeto

**Decisão: Column-level encryption em vez de disk-only**
Motivação: SweetCare processa PHI de menores (LGPD Art. 14). Disk encryption não protege contra SQL injection, backups expostos ou acesso interno mal-configurado. AES-256-GCM por campo protege em todas as camadas.
Impacto: Prisma `$extends` em `client.ts`; `PHI_FIELDS` map em `encryption-middleware.ts`; PHI int fields armazenados como strings cifradas.

**Decisão: Refresh token como opaque token (não JWT)**
Motivação: JWTs de refresh não podem ser invalidados sem uma denylist. Tokens opacos com SHA-256 no banco permitem family invalidation instantânea na detecção de roubo.
Impacto: `session.repository.ts`; cookie `sc_refresh_token` HttpOnly; endpoint `/auth/refresh` lê do cookie.

**Decisão: RLS + triggers no banco para imutabilidade**
Motivação: Apenas application-layer protection para registros médicos é insuficiente — uma query administrativa acidental pode corromper o audit trail. Triggers `BEFORE UPDATE OR DELETE` tornam InsulinApplicationRecord, SymptomRecord e AuditEntry efetivamente imutáveis mesmo para admins.
Impacto: `rls-policies.sql` deve ser aplicado manualmente após migrations Prisma.

**Decisão: AI service em rede interna isolada**
Motivação: O serviço de IA não deve ser alcançável da internet. Todo acesso passa pelo proxy Fastify que remove PHI antes de encaminhar.
Impacto: `compose.dev.yml` usa `networks.internal` (sem bridge para host); middleware em `app/main.py` rejeita requisições sem `X-Internal-Request-Id`.

**Decisão: Monorepo pnpm + Turborepo**
Motivação: Consistência de contratos entre mobile e API via `@sweetcare/shared-types` e `@sweetcare/shared-validation`. Turborepo cache reduz tempo de CI.
Rejeitado: Nx (overhead de code generation), Lerna (sem cache nativo), npm workspaces (hoisting menos estrito que pnpm).

### 2026-05-27 — Phase 3 (US1) completa

**Decisão: Criação atômica de PatientProfile + CaregiverAssignment + ConsentRecord**
Motivação: `ConsentRecord` requer `patientProfileId` e `PatientProfile` requer consentimento ativo — dependência circular. Resolvido com `prisma.$transaction` que cria os três na mesma TX eliminando a janela entre criação e consentimento.
Impacto: `patients.routes.ts`; o guardian sempre é `primary_guardian` na criação; consentimento `data_processing` é auto-gerado (LGPD Art. 14).

**Decisão: cursor de paginação como base64url(ISO timestamp)**
Motivação: Paginação keyset por timestamp é segura para inserções concorrentes (sem page drift). Base64url é URL-safe sem encoding adicional.
Impacto: `insulin-record.repository.ts`, `symptom-record.repository.ts`; cursor decodificado via `Buffer.from(cursor, "base64url")`.

**Decisão: Timeline merges em memória (não JOIN)**
Motivação: Insulin records e symptom records têm timestamps diferentes (`appliedAt` vs `observedAt`) — um JOIN unificado exigiria UNION SQL com alias complexo e perde type safety do Prisma. Merge em memória é correto para o volume esperado (limit ≤ 200 por request).
Impacto: `timeline.routes.ts` faz duas queries paralelas e ordena em memória; total_count é soma dos dois totais.

**Decisão: offline-queue com fetch direto, sem React Query persist-client**
Motivação: `@tanstack/react-query-persist-client` não estava nas dependências e adiciona complexidade de serialização. O padrão try-API-then-SQLite é mais simples, testável e não depende de estado de cache.
Impacto: `offline-queue.ts`; `sync-engine.ts` usa `AppState` do React Native para trigger no foreground; sem nova dependência adicionada.

**Decisão: zodResolver inline em InsulinLogScreen (sem @hookform/resolvers)**
Motivação: `@hookform/resolvers` não estava nas dependências. Um zodResolver de 10 linhas cobre o caso de uso sem adicionar dependência.
Impacto: `InsulinLogScreen.tsx` exporta o resolver localmente; padrão reutilizável para futuros formulários.

### 2026-05-28 — Phase 4 (US2) completa

**Decisão: Alerta criado na mesma chamada de `createSymptomRecord`, não em worker assíncrono**
Motivação: Contratos de emergência exigem feedback síncrono. Um alerta perdido por falha de worker em cenário de `loss_of_consciousness` é inaceitável. O padrão fail-safe garante que a falha do alerta nunca reverte o registro do sintoma.
Impacto: `symptom-record.service.ts`; push notification é fire-and-forget (falha não bloqueia resposta); `alert-event.repository.ts` com criação atômica.

**Decisão: Alert rule engine como função pura sem I/O**
Motivação: Regras de alerta são determinísticas e safety-critical — testabilidade total sem mocks é mandatória. Qualquer I/O acidental (log, DB) poderia mascarar bugs de priorização.
Impacto: `alert-rule-engine.ts` é puramente funcional; 9 casos de teste unitários sem nenhum mock.

### 2026-05-28 — Phase 5 (US3) completa

**Decisão: Geração de relatório assíncrona (202 + polling) em vez de SSE ou WebSocket**
Motivação: O AI service pode levar até 30s. SSE/WebSocket adicionaria complexidade de infra (sticky sessions, reconnect) sem benefício real para este caso. Polling com `refetchInterval` no React Query é suficiente e offline-safe.
Impacto: `insights.routes.ts` retorna 202 imediatamente; `InsightsDashboardScreen.tsx` usa `refetchInterval: 5000` enquanto há relatórios em `processing`.

**Decisão: Verificação de dados mínimos síncrona no POST (não no background)**
Motivação: Criar um relatório `processing` que vai imediatamente para `failed` por dados insuficientes é uma UX ruim. A verificação síncrona de `≥ 3 registros de insulina` evita registros fantasma e reduz ruído no banco.
Impacto: `insight-aggregation.service.ts` é chamado duas vezes (check + background) — custo aceitável para o volume esperado.

**Decisão: AI service retorna somente métricas estatísticas; jamais texto livre clínico**
Motivação: LGPD Art. 14 + contrato `contracts/api-insights.md` proíbem recomendações clínicas em saídas de IA. Todos os `description` em `PatternFinding` descrevem padrões observados, não ações a tomar.
Impacto: `analysis_service.py` — cada detector usa linguagem descritiva ("foram registrados X eventos") nunca prescritiva ("administre", "consulte").

**Decisão: Schema do banco aplicado via `prisma migrate diff --from-empty --script` + `docker exec psql`**
Motivação: `prisma db push` falha com P1000 (auth) quando executado do Windows host para container Docker Desktop — o Prisma Rust engine não consegue resolver `localhost` para o container. A geração de SQL e aplicação interna bypassa esse problema sem alterar a configuração de rede.
Impacto: Schema aplicado manualmente uma vez; `prisma generate` regenera o client normalmente. Para novos developers, usar o mesmo padrão ou acessar via `docker exec`.

### 2026-05-28 — T077 (Phase 6) Security Hardening — OWASP Top 10

**Decisão: 404 para recursos inacessíveis em vez de 403 em `GET /alerts/:id` e `PATCH /alerts/:id/resolve`**
Motivação: Retornar 403 quando um alert existe mas o user não tem acesso vaza a existência do alert para qualquer usuário autenticado (IDOR). O padrão correto é retornar 404 tanto para "não encontrado" quanto para "sem acesso", eliminando enumeração de IDs.
Impacto: `alerts.routes.ts`; comportamento uniforme — cliente não consegue distinguir inexistência de acesso negado.

**Decisão: `checkPatientAccess` inline em `POST /insights/reports` em vez de `requirePatientAccess` middleware**
Motivação: `requirePatientAccess` lê `request.params.patientId` mas a rota passa `patient_id` no body → middleware sempre retornava 400, bloqueando todos os requests legítimos. A verificação inline com `checkPatientAccess(userId, body.patient_id)` resolve o mismatch sem criar novo middleware.
Impacto: `insights.routes.ts`; rota agora funciona corretamente para usuários autorizados.

**Decisão: Validação de cursor com try/catch + NaN check em `GET /patients/:id/timeline`**
Motivação: `new Date(Buffer.from(cursor, 'base64url').toString())` sem validação propagava `Invalid Date` silenciosamente, causando comportamento imprevisível na paginação. Falha explícita com 400 é mais segura e debugável.
Impacto: `timeline.routes.ts`; schema de `from`/`to` trocado para `z.string().datetime()` (estava `z.string()` simples).

**Correções aplicadas (T077):**

- SQL injection: `$executeRawUnsafe` → `$executeRaw` tagged template em `client.ts`
- IDOR em alertas: fetch antes de checar acesso → acesso unificado retornando 404
- Write-role check ausente: `PATCH /alerts/:id/resolve` agora bloqueia role `read_only` via `isReadOnly()`
- `requirePatientAccess` quebrado em insights POST: removido do preHandler, substituído por check inline
- Cursor e datas inválidos em timeline: validação com try/catch e `isNaN` check
- Datas inválidas em insights: `isNaN` check antes de `validateReportPeriod`
- `bodyLimit: 1_048_576` adicionado ao Fastify (proteção DoS via payload grande)
- Error handler: `error.message` raw removido das respostas 4xx (prevenção de info disclosure)
- Helmet CSP: adicionados `styleSrc`, `imgSrc`, `connectSrc`, `fontSrc`, `frameSrc`, `frameAncestors`, `formAction`
- Rate limit: `/auth/register` e `/auth/login` com limite de 5 req/15min (anti brute-force)

---

_Última atualização: 2026-05-28 — T077 Security Hardening (Phase 6) completo_
_Próxima atualização obrigatória: ao iniciar T072 acessibilidade ou T078 LGPD data rights_
