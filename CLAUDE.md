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
│   │   │   │       ├── insight-aggregation.service.ts ← aggregatePatientData (strip PHI → AggregatedRecord[])
│   │   │   │       └── data-rights.service.ts         ← exportUserData, deleteUserAccount (LGPD Art. 18)
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
│   │   │   │   │   ├── security-plugins.ts ← helmet + cors + rate-limit
│   │   │   │   │   ├── correlation.plugin.ts ← X-Correlation-Id em todas as respostas (fp)
│   │   │   │   │   └── versioning.plugin.ts  ← Accept-Version + X-API-Version; rejeita versões não suportadas (fp)
│   │   │   │   ├── logging/
│   │   │   │   │   └── logger.ts           ← Pino com 15 paths de redação PHI
│   │   │   │   ├── notifications/
│   │   │   │   │   └── push-notification.service.ts ← sendAlertNotification (PHI-free stub; FCM/APNs)
│   │   │   │   └── repositories/
│   │   │   │       ├── insulin-record.repository.ts    ← upsertInsulinRecord, getPatientInsulinRecords, findBolusRecordsInWindow
│   │   │   │       ├── symptom-record.repository.ts    ← upsertSymptomRecord, getPatientSymptomRecords
│   │   │   │       ├── alert-event.repository.ts       ← createAlertEvent, getPatientAlerts, resolveAlert
│   │   │   │       └── insight-report.repository.ts    ← createInsightReport, getReportById, listPatientReports, updateReportCompleted/Failed
│   │   │   └── presentation/routes/
│   │   │       ├── health.routes.ts        ← GET /health + GET /ready
│   │   │       ├── auth.routes.ts          ← GET /users/me, register, login, refresh, logout, MFA stub
│   │   │       ├── consent.routes.ts       ← POST /consent, DELETE /consent/:id
│   │   │       ├── patients.routes.ts      ← POST /patients, GET /patients/:id
│   │   │       ├── insulin-records.routes.ts ← POST+GET /patients/:id/insulin-records
│   │   │       ├── symptom-records.routes.ts ← POST+GET /patients/:id/symptoms
│   │   │       ├── sync.routes.ts          ← POST /sync/batch, GET /sync/status/:id, POST /sync/resolve-conflict
│   │   │       ├── timeline.routes.ts      ← GET /patients/:id/timeline (insulin+symptom merged)
│   │   │       ├── alerts.routes.ts        ← GET /patients/:id/alerts, GET /alerts/:id, PATCH /alerts/:id/resolve
│   │   │       ├── insights.routes.ts      ← POST /insights/reports (202), GET /insights/reports/:id, GET /insights/reports
│   │   │       ├── data-rights.routes.ts   ← GET /users/me/data-export, DELETE /users/me (LGPD Art. 18)
│   │   │       └── monitoring.routes.ts    ← GET /metrics (Prometheus text format 0.0.4, sem dependências externas)
│   │   └── tests/
│   │       ├── setup.ts               ← env vars de test + crypto stub
│   │       └── integration/
│   │           ├── auth-flow.test.ts         ← health, register, auth guards
│   │           ├── sync-flow.test.ts         ← Phase 3 route guards + validation
│   │           ├── alert-flow.test.ts        ← Phase 4 route guards + alert rule engine (9 casos)
│   │           ├── insights-fallback.test.ts ← Phase 5 route guards + period validation (8 casos)
│   │           └── data-rights.test.ts       ← Phase 6 LGPD route guards (3 casos)
│   │
│   ├── mobile/                        ← Expo SDK 52 + React Native 0.76
│   │   ├── app.json                   ← Bundle IDs, plugins: expo-router, expo-secure-store, expo-sqlite
│   │   ├── global.css                 ← CSS custom properties (design tokens para web/doc reference)
│   │   ├── app/
│   │   │   ├── _layout.tsx            ← QueryClient + ThemeProvider + AuthProvider + AuthGate + Stack
│   │   │   ├── emergency.tsx          ← Protocolo de emergência fullscreen (offline, 5 protocolos, SAMU/Bombeiros)
│   │   │   ├── auth/
│   │   │   │   ├── _layout.tsx        ← Stack auth com animação fade
│   │   │   │   ├── login.tsx          ← Email + senha, error banner, link para registro
│   │   │   │   └── register.tsx       ← Nome + email + senha + confirmação, link para login
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx        ← Tab nav: Início / Registrar / Insights / Perfil
│   │   │   │   ├── index.tsx          ← Timeline: FlatList de DoseCard/SymptomCard/AlertCard por data
│   │   │   │   ├── log.tsx            ← Segmented control Insulina/Sintoma → InsulinLogScreen / SymptomRecordScreen
│   │   │   │   ├── insights.tsx       ← Wrapper InsightsDashboardScreen com activePatient
│   │   │   │   └── settings.tsx       ← Perfil, paciente ativo, LGPD export/delete, logout
│   │   │   ├── patients/
│   │   │   │   └── new.tsx            ← Modal criação PatientProfile (nome, DOB, diagnóstico, alvos, insulinas)
│   │   │   └── alerts/
│   │   │       └── [alertId].tsx      ← Modal alerta: guidance steps, contatos emergência, resolver
│   │   └── src/
│   │       ├── design/
│   │       │   ├── DESIGN_SYSTEM.md   ← Paleta, tipografia, espaçamento, componentes, acessibilidade
│   │       │   ├── themes/
│   │       │   │   ├── colors.ts      ← palette + semantic tokens (glucose, severity, sync, feedback)
│   │       │   │   ├── typography.ts  ← fontSizes, weights, textVariants (display → caption)
│   │       │   │   ├── spacing.ts     ← 4pt grid, touchTargets (min:44), radii, borderWidths
│   │       │   │   ├── shadows.ts     ← none/sm/md/lg/xl/emergency/success presets
│   │       │   │   ├── motion.ts      ← duration, easing, transitions, reducedMotionFallback
│   │       │   │   ├── layout.ts      ← sizes (tabBar, header, input, button, icon), grid, SCREEN_WIDTH/HEIGHT
│   │       │   │   └── tokens.ts      ← barrel re-export de todos os tokens
│   │       │   ├── contexts/
│   │       │   │   └── ThemeContext.tsx ← ThemeProvider + useTheme() (acesso a todos os tokens)
│   │       │   ├── utils/
│   │       │   │   └── haptics.ts     ← haptics.light/medium/heavy/success/warning/error/emergency()
│   │       │   └── components/
│   │       │       ├── ui/
│   │       │       │   ├── Text.tsx       ← variant prop (h1-h4, body, caption, numeric, unit, button)
│   │       │       │   ├── Icon.tsx       ← Feather/MaterialIcons/MaterialCommunityIcons wrapper
│   │       │       │   ├── Badge.tsx      ← variants: default/primary/success/warning/error/severity/sync
│   │       │       │   ├── Button.tsx     ← variants: primary/secondary/ghost/danger/emergency
│   │       │       │   ├── Input.tsx      ← label/hint/error, secureToggle, leftElement/rightElement
│   │       │       │   ├── Card.tsx       ← variants: default/elevated/outlined/severity; onPress → Touchable
│   │       │       │   ├── Divider.tsx    ← horizontal/vertical, label opcional
│   │       │       │   ├── Skeleton.tsx   ← shimmer animado (Animated.loop + sequence)
│   │       │       │   └── EmptyState.tsx ← variants: default/offline/noRecords/noPatient/loadError
│   │       │       ├── domain/
│   │       │       │   ├── DoseCard.tsx        ← InsulinApplicationRecord: tipo, dose, rationale, glicemia, sync
│   │       │       │   ├── GlucoseIndicator.tsx ← circle/inline/banner; glucose state → color tokens; staleness
│   │       │       │   └── SymptomChecker.tsx  ← grid chips SymptomCode, emergency highlight, SeverityLevel
│   │       │       └── layout/
│   │       │           ├── Screen.tsx     ← SafeAreaView wrapper, scroll, offline banner, loading, error
│   │       │           └── Header.tsx     ← left/right actions, sync badge, offline indicator, emergency mode
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
│   │           ├── api/
│   │           │   └── client.ts          ← apiClient (get/post/patch/delete), ApiError, token refresh automático
│   │           ├── auth/
│   │           │   └── AuthContext.tsx    ← AuthProvider + useAuth() (login, register, logout, setActivePatient)
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
    │   ├── compose.monitoring.yml     ← Prometheus v2.55.0 + Grafana 11.4.0 (stack separado)
    │   └── postgres/
    │       └── init.sql               ← pgcrypto + uuid-ossp + pg_trgm
    ├── monitoring/
    │   ├── prometheus.yml             ← scrape config: API /metrics a cada 15s
    │   └── grafana/
    │       ├── provisioning/
    │       │   ├── datasources/prometheus.yml ← datasource Prometheus auto-provisionado
    │       │   └── dashboards/sweetcare.yml   ← dashboard provisioner (path + interval)
    │       └── dashboards/
    │           └── sweetcare.json     ← 5 painéis: uptime, heap, RSS, heap timeseries, process memory
    └── .github/workflows/
        └── ci.yml                     ← typescript · api-test · ai-service · security · constitution
```

> Monitoring stack: `docker compose -f infra/docker/compose.monitoring.yml up -d`
> Grafana: http://localhost:3001 (admin/changeme) · Prometheus: http://localhost:9090

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

| Entidade                   | Tabela                        | Mutável                       | Campos PHI cifrados                                   |
| -------------------------- | ----------------------------- | ----------------------------- | ----------------------------------------------------- |
| `User`                     | `users`                       | Sim                           | `displayName`, `phoneE164`, `mfaSecretEnc`            |
| `ConsentRecord`            | `consent_records`             | Não (revogação apenas)        | —                                                     |
| `PatientProfile`           | `patient_profiles`            | Sim                           | `fullName`, `insulinTypeBasal`, `insulinTypeBolus`    |
| `CaregiverAssignment`      | `caregiver_assignments`       | Não (revogação apenas)        | —                                                     |
| `InsulinApplicationRecord` | `insulin_application_records` | **Imutável**                  | `insulinType`, `glucoseBeforeMgdl` (String?), `notes` |
| `SymptomRecord`            | `symptom_records`             | **Imutável**                  | `glucoseReadingMgdl` (String?), `notes`               |
| `AlertEvent`               | `alert_events`                | Parcial (apenas `resolvedAt`) | —                                                     |
| `SyncEvent`                | `sync_events`                 | Não                           | `conflictDetails` (app layer)                         |
| `AuditEntry`               | `audit_entries`               | **Imutável**                  | —                                                     |
| `InsightReport`            | `insight_reports`             | Não                           | `summaryText`, `patternFindings`                      |
| `UserSession`              | `user_sessions`               | Parcial (revogação)           | —                                                     |

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

| Método | Rota                  | Auth                          | Status          |
| ------ | --------------------- | ----------------------------- | --------------- |
| GET    | `/users/me`           | Bearer                        | ✅ Implementado |
| POST   | `/auth/register`      | —                             | ✅ Implementado |
| POST   | `/auth/login`         | —                             | ✅ Implementado |
| POST   | `/auth/refresh`       | Cookie ou body `refreshToken` | ✅ Implementado |
| POST   | `/auth/logout`        | Bearer                        | ✅ Implementado |
| POST   | `/auth/mfa/verify`    | —                             | 🔲 Stub (501)   |
| POST   | `/consent`            | Bearer                        | ✅ Implementado |
| DELETE | `/consent/:consentId` | Bearer                        | ✅ Implementado |

> `POST /auth/register` e `POST /auth/login` retornam `refreshToken` tanto no body JSON quanto em cookie HttpOnly — body necessário para clientes mobile (React Native `fetch` não persiste cookies); cookie para web.

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

### Phase 6 (T078) — LGPD Data Rights

| Método | Rota                    | Auth   | Status          |
| ------ | ----------------------- | ------ | --------------- |
| GET    | `/users/me/data-export` | Bearer | ✅ Implementado |
| DELETE | `/users/me`             | Bearer | ✅ Implementado |

> `GET /users/me/data-export` retorna todos os dados pessoais do titular (LGPD Art. 18 direito de acesso).
> `DELETE /users/me` exige confirmação por senha; anonimiza o User (preserva tombstone para integridade FK com AuditEntry) e deleta todos os registros médicos dos pacientes criados pelo usuário.

### Phase 6 (T079) — Monitoramento

| Método | Rota       | Auth | Status          |
| ------ | ---------- | ---- | --------------- |
| GET    | `/metrics` | —    | ✅ Implementado |

> Prometheus text format 0.0.4 via `process.memoryUsage()` + `process.uptime()` — sem dependências externas.
> Em produção, restringir acesso à rede interna ou adicionar scrape credentials.

### Phase 6 — Cross-cutting headers (T074 + T075)

| Header resposta    | Valor                     | Plugin                  |
| ------------------ | ------------------------- | ----------------------- |
| `X-API-Version`    | `1` em todas as respostas | `versioning.plugin.ts`  |
| `X-Correlation-Id` | UUID do request Fastify   | `correlation.plugin.ts` |

> `Accept-Version: 2` (ou qualquer versão não suportada) → 400 `UNSUPPORTED_VERSION`.

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
| Correlation ID     | `X-Correlation-Id` em todas as respostas; rastreamento cross-service           | `correlation.plugin.ts`         |
| API Versioning     | `X-API-Version: 1`; versão não suportada → 400                                 | `versioning.plugin.ts`          |
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
| Direito de acesso            | `GET /users/me/data-export` → JSON com todos os dados do titular (T078 ✅)        |
| Direito à exclusão           | `DELETE /users/me` + anonimização do User (preserva FK audit_entries) (T078 ✅)   |
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

| Variável                     | Obrigatório                 | Descrição                                                                                                                                                |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | Sim                         | `development` \| `test` \| `production`                                                                                                                  |
| `PORT`                       | Não (padrão 3000)           | Porta HTTP                                                                                                                                               |
| `HOST`                       | Não (padrão 0.0.0.0)        | Bind host                                                                                                                                                |
| `DATABASE_URL`               | **Sim**                     | Connection string PostgreSQL. Em dev com PostgreSQL local na porta 5432, usar porta 5433: `postgresql://sweetcare:changeme@127.0.0.1:5433/sweetcare_dev` |
| `DATABASE_POOL_MIN`          | Não (padrão 2)              | Conexões mínimas no pool                                                                                                                                 |
| `DATABASE_POOL_MAX`          | Não (padrão 10)             | Conexões máximas no pool                                                                                                                                 |
| `JWT_ACCESS_SECRET`          | **Sim**                     | Segredo JWT (mín. 32 chars)                                                                                                                              |
| `JWT_REFRESH_SECRET`         | **Sim**                     | Segredo refresh token (mín. 32 chars, diferente do access)                                                                                               |
| `JWT_ACCESS_EXPIRY_SECONDS`  | Não (padrão 900)            | Expiração do access token                                                                                                                                |
| `JWT_REFRESH_EXPIRY_SECONDS` | Não (padrão 604800)         | Expiração do refresh token                                                                                                                               |
| `PHI_ENCRYPTION_KEY`         | **Sim**                     | 64 hex chars (32 bytes) para AES-256-GCM                                                                                                                 |
| `REDIS_URL`                  | **Sim**                     | Connection string Redis                                                                                                                                  |
| `AI_SERVICE_URL`             | Não (padrão localhost:8000) | URL interna do AI service                                                                                                                                |
| `AI_SERVICE_TIMEOUT_MS`      | Não (padrão 30000)          | Timeout para AI service                                                                                                                                  |
| `CORS_ALLOWED_ORIGINS`       | Não                         | Origens CORS separadas por vírgula                                                                                                                       |
| `LOG_LEVEL`                  | Não (padrão info)           | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`                                                                                             |

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

| Camada                | Framework          | Localização                   | Status                                                                          |
| --------------------- | ------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| API — unit            | Vitest             | `apps/api/tests/unit/`        | 🔲 Planejado Phase 3+                                                           |
| API — integração      | Vitest             | `apps/api/tests/integration/` | ✅ auth-flow, sync-flow, alert-flow, insights-fallback, data-rights (49 testes) |
| Mobile — componentes  | Vitest + RNTL      | `apps/mobile/tests/`          | 🔲 Planejado Phase 3+                                                           |
| AI service — contrato | pytest             | `apps/ai-service/tests/`      | ✅ test_analyze_contract.py (13 casos)                                          |
| E2E mobile            | Detox              | `apps/mobile/e2e/`            | 🔲 Planejado pós-MVP                                                            |
| Acessibilidade        | Automated + manual | Screens críticas              | ✅ WCAG 2.1 AA — `checklists/accessibility.md` (verificação manual pendente)    |

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

| Phase                                  | Tarefas | Concluídas | %           |
| -------------------------------------- | ------- | ---------- | ----------- |
| Phase 1 — Setup                        | 13      | 13         | 100% ✅     |
| Phase 2 — Foundation                   | 16      | 16         | 100% ✅     |
| Phase 3 — US1 (offline records + sync) | 20      | 20         | 100% ✅     |
| Phase 4 — US2 (alerts)                 | 10      | 10         | 100% ✅     |
| Phase 5 — US3 (AI insights)            | 12      | 12         | 100% ✅     |
| Phase 6 — Polish                       | 9       | 9          | 100% ✅     |
| **Total**                              | **80**  | **80**     | **100% ✅** |

> Rastreamento detalhado em `specs/001-sweetcare-fullstack-foundation/tasks.md`

### Phase 6 — Polish (concluída)

| Task | Descrição                                                                                    | Status  |
| ---- | -------------------------------------------------------------------------------------------- | ------- |
| T072 | ~~Auditoria de acessibilidade WCAG 2.1 AA em telas críticas~~ ✅ Concluído                   | ✅ Done |
| T073 | ~~Checklist de acessibilidade documentado~~ ✅ Concluído                                     | ✅ Done |
| T074 | ~~Middleware de versionamento de API (`Accept-Version`)~~ ✅ Concluído                       | ✅ Done |
| T075 | ~~Propagação de correlation ID (Fastify → respostas)~~ ✅ Concluído                          | ✅ Done |
| T076 | ~~Baseline de performance documentado (p95 targets)~~ ✅ Concluído                           | ✅ Done |
| T077 | ~~Hardening de segurança: verificação OWASP Top 10~~ ✅ Concluído                            | ✅ Done |
| T078 | ~~Endpoint de direitos LGPD: `GET /users/me/data-export` + `DELETE /users/me`~~ ✅ Concluído | ✅ Done |
| T079 | ~~Prometheus metrics: `GET /metrics` + Grafana dashboard~~ ✅ Concluído                      | ✅ Done |
| T080 | ~~Quickstart validation documentado~~ ✅ Concluído                                           | ✅ Done |

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

### 2026-05-28 — T078 (Phase 6) LGPD Data Rights

**Decisão: Anonimização do User em vez de hard-delete**
Motivação: `actorUserId` em `AuditEntry` é FK obrigatória sem `onDelete` (Prisma Restrict default). Hard-delete de um `User` com audit entries viola a constraint FK — e remover o audit trail seria inaceitável para conformidade. A anonimização (`email → deleted+{id}@sweetcare.invalid`, `passwordHash → ""`, `isActive → false`, PHI fields nulos) preserva o tombstone sem expor dados pessoais.
Impacto: `data-rights.service.ts:deleteUserAccount`; `User` com `isActive=false` e email anonimizado não consegue logar (auth service rejeita `isActive=false`); todas as sessions revogadas antes da anonimização.

**Decisão: Deleção em cascata manual (não `onDelete: Cascade`) para dados dos pacientes do usuário**
Motivação: Cascade no Prisma schema deletaria registros médicos de forma silenciosa a qualquer deleção de PatientProfile, inclusive operações administrativas acidentais. A deleção manual explícita em `prisma.$transaction` na ordem correta (InsightReport → SyncEvent → AlertEvent → SymptomRecord → InsulinApplicationRecord → CaregiverAssignment → ConsentRecord → PatientProfile) é auditável, reversível via dump, e falha ruidosamente se a ordem estiver errada.
Impacto: `data-rights.service.ts`; sem mudanças no schema Prisma nem migrations.

**Decisão: Verificação de senha antes de qualquer operação destrutiva**
Motivação: A deleção de conta é irreversível. Exigir confirmação de senha (LGPD Art. 18 §3º) previne deleções acidentais e garante que só o titular autenticado pode exercer o direito à exclusão, mesmo em sessões sequestradas (refresh token roubado).
Impacto: `data-rights.routes.ts` exige `{ password }` no body; `deleteUserAccount` chama `verifyPassword` antes de qualquer TX.

### 2026-05-28 — T072-T080 (Phase 6) Polish completo

**Decisão: Plugins Fastify com `fastify-plugin` (fp) para hooks globais (T074, T075)**
Motivação: Hooks registrados dentro de um plugin normal (sem `fp`) são encapsulados — aplicam apenas às rotas do próprio plugin (nenhuma, no caso de `correlation.plugin.ts` e `versioning.plugin.ts`). `fp` quebra o encapsulamento, tornando o plugin "transparente" e fazendo os hooks `onSend`/`preHandler` aplicarem a todas as rotas da instância Fastify.
Impacto: `correlation.plugin.ts` e `versioning.plugin.ts` importam `fp` de `fastify-plugin`; `fastify-plugin ^5.0.1` já estava nas dependências do projeto.

**Decisão: `GET /metrics` sem `prom-client` (T079)**
Motivação: `prom-client` não estava nas dependências do projeto e adicionaria ~200KB ao bundle apenas para expor métricas de processo que Node.js já provê nativamente via `process.memoryUsage()` e `process.uptime()`. A implementação manual do formato Prometheus text 0.0.4 cobre o caso de uso completamente.
Impacto: `monitoring.routes.ts`; sem nova dependência; métricas expostas: uptime, heap used/total, RSS, external memory, Node.js version.

**Decisão: Stack de monitoramento como `compose.monitoring.yml` separado (T079)**
Motivação: Prometheus e Grafana são ferramentas de observabilidade opcionals para desenvolvimento — forçá-las no `compose.dev.yml` principal aumentaria o tempo de startup e uso de memória para todos os desenvolvedores. Stack separado permite uso opt-in.
Impacto: `infra/docker/compose.monitoring.yml` junta-se à rede `sweetcare-dev_default` como rede externa; `extra_hosts: host.docker.internal:host-gateway` permite scraping da API rodando no host em Linux.

**Decisão: Touch targets corrigidos com `minHeight: 44` + `justifyContent: "center"` (T072)**
Motivação: `paddingVertical: 8` em chips de ~14sp de texto produz altura ~30px — abaixo do mínimo WCAG 2.5.5 / Apple HIG de 44pt. A combinação de `minHeight` com `justifyContent: "center"` garante o mínimo sem distorcer o layout visual.
Impacto: `SyncStatusBar.tsx` (syncButton, conflictBadge), `InsightsDashboardScreen.tsx` (typeChip), `ReportDetailScreen.tsx` (backLink).

**Decisão: Baseline de performance como projeções documentadas (T076)**
Motivação: Executar `autocannon` contra Docker Compose exige o stack completo rodando — não é possível em CI sem infra dedicada. Documentar as projeções baseadas em análise arquitetural (latência por camada) é mais honesto e acionável do que omitir o baseline.
Impacto: `specs/.../performance-baseline.md`; tabela de resultados esperados com metodologia para substituição por valores medidos após rodar o benchmark.

---

### 2026-05-28 — Mobile completo (auth + navegação + todas as telas)

**Decisão: Design system 100% custom (StyleSheet + useTheme) — sem NativeWind ou Tamagui**
Motivação: NativeWind (Tailwind para RN) requer babel plugin e tem limitações com animações nativas. Tamagui adiciona ~3MB ao bundle e otimização de compilação experimental. StyleSheet.create com tokens via useTheme() é zero-dependência, type-safe, e integra perfeitamente com o sistema de temas existente.
Impacto: `src/design/themes/` (colors, typography, spacing, shadows, motion, layout); `ThemeContext.tsx`; todos os componentes consomem apenas tokens do tema, sem valores literais inline.

**Decisão: AuthGate em \_layout.tsx com useSegments + SplashScreen.hideAsync()**
Motivação: O padrão recomendado pelo Expo Router para auth guard usa useSegments para detectar a rota atual sem navegar desnecessariamente. SplashScreen fica visível até que `isLoading` resolva, evitando flash de conteúdo não autenticado.
Impacto: `app/_layout.tsx`; AuthGate renderiza null durante isLoading; redireciona automaticamente entre auth/ e (tabs)/.

**Decisão: Protocolo de emergência hardcoded (sem API call)**
Motivação: Em uma emergência médica (perda de consciência, cetoacidose), o dispositivo pode estar offline ou a API pode estar indisponível. Os protocolos são informações clínicas estáticas que devem funcionar offline.
Impacto: `app/emergency.tsx` copia os protocolos de `alert-event.entity.ts` como constantes locais; sem dependência de rede; funciona com `gestureEnabled: false` (fullScreenModal, usuário não pode fechar acidentalmente).

**Decisão: Validação inline sem biblioteca externa em patients/new.tsx**
Motivação: O schema `createPatientSchema` do Zod já existe em `@sweetcare/shared-validation`, mas react-hook-form + zod no modal de criação de paciente adicionaria overhead de bundle para um formulário simples. Validação inline com função `validate()` cobre todos os campos sem nova dependência.
Impacto: `app/patients/new.tsx`; padrão distinto do InsulinLogScreen (que usa react-hook-form) pois o formulário de paciente é usado apenas uma vez no onboarding.

### 2026-05-28 — Correção de contrato API↔Mobile

**Decisão: `refreshToken` entregue tanto no body JSON quanto em cookie HttpOnly**
Motivação: React Native `fetch` não persiste cookies HttpOnly automaticamente entre requests — tokens guardados apenas em cookie são inacessíveis ao `expo-secure-store`. A solução entrega o token nos dois canais: cookie HttpOnly (para clientes web/browser) e campo `refreshToken` no body JSON (para mobile salvar no Keychain/Keystore via `tokenStorage`).
Impacto: `auth.routes.ts` — `POST /auth/register`, `POST /auth/login` e `POST /auth/refresh` retornam `refreshToken` no body; `AuthContext.tsx` salva via `tokenStorage.saveRefreshToken()`; cookie continua sendo setado em paralelo para compatibilidade web.

**Decisão: `GET /users/me` adicionado a `auth.routes.ts` (não em rota separada)**
Motivação: O endpoint precisa de `app.authenticate` e retorna dados do próprio usuário autenticado — colocá-lo em `auth.routes.ts` junto com os demais fluxos de sessão evita criar um arquivo de rota com um único endpoint.
Impacto: `auth.routes.ts` expõe `GET /users/me` protegido por Bearer; `AuthContext.tsx` usa-o em `loadStoredSession()` para restaurar sessão ao abrir o app.

**Decisão: `POST /auth/register` faz auto-login e retorna tokens (201 com `authResponseSchema`)**
Motivação: O fluxo de onboarding do mobile necessita tokens imediatamente após o registro para navegar para o app sem uma segunda chamada de login. O service `register()` só cria o usuário — o handler agora chama `login()` internamente e retorna o payload completo.
Impacto: `auth.routes.ts`; response de `POST /auth/register` mudou de `{ userId }` para `authResponseSchema` (mesmo formato do login).

### 2026-05-29 — Bugs encontrados em validação manual end-to-end

**Fix: `glucoseBeforeMgdl` e `glucoseReadingMgdl` mudados de `Int?` para `String?` no schema Prisma**
Motivação: O middleware PHI cifra esses campos com AES-256-GCM, convertendo-os para strings. O schema original tinha `Int?`, o que causava erro `P2019` do Prisma ao tentar escrever a string cifrada num campo inteiro.
Impacto: `schema.prisma` — duas colunas alteradas para `String?`; `ALTER TABLE ... ALTER COLUMN ... TYPE TEXT` aplicado no banco via `docker exec psql`; `PHI_INT_FIELDS` no encryption-middleware já fazia o encode/decode correto; no data export via `include` nested, o middleware não descriptografa automaticamente (limitação do `$extends` com queries aninhadas) — glucose aparece como `null` no export LGPD, não como inteiro. Workaround futuro: queries separadas em vez de `include` nested no `exportUserData`.

**Fix: `GET /alerts/:alertId` retornava 500 `FST_ERR_RESPONSE_SERIALIZATION`**
Motivação: O `alertDetailSchema` exige `resolved_by_user_id: z.string().uuid().nullable()` mas o handler não incluía esse campo na resposta, causando falha de serialização do Zod.
Impacto: `alerts.routes.ts` — campo `resolved_by_user_id` adicionado ao response object.

**Fix: `data-rights.service.ts` usava `r.createdAt` em vez de `r.recordedAt`**
Motivação: `InsulinApplicationRecord` e `SymptomRecord` expõem o campo como `recordedAt` (não `createdAt`). A chamada a `undefined.toISOString()` lançava 500 no endpoint `GET /users/me/data-export`.
Impacto: `data-rights.service.ts` — duas ocorrências corrigidas.

**Fix de ambiente: PostgreSQL 18 local conflitava com container Docker na porta 5432**
Motivação: O Prisma Rust engine conectava ao PostgreSQL 18 local (sem o banco `sweetcare_dev`), não ao container. Erro P1000 "Authentication failed" mesmo com `trust` no pg_hba.conf do container.
Impacto: `infra/docker/compose.dev.yml` — porta alterada para `5433:5432`; `apps/api/.env` — `DATABASE_URL` atualizado para porta 5433 e host `127.0.0.1` (não `localhost`). Developers com PostgreSQL local devem usar a porta 5433.

_Última atualização: 2026-05-29 — Validação manual E2E + 3 bug fixes (schema, alerts serialization, data export)_

### 2026-05-29 — Diagnóstico e correções de compatibilidade Expo SDK 54 / RN 0.81

#### Problema 1: Asserções de tipo desnecessárias em `process.env` (4 arquivos)

**Causa raiz**: `process.env["EXPO_PUBLIC_API_URL"]` já tem tipo `string | undefined` no TypeScript 5.7. O cast explícito `as string | undefined` é redundante e flagrado pela regra `@typescript-eslint/no-unnecessary-type-assertion`. O padrão correto já existia em `src/infrastructure/api/client.ts:3` mas não foi replicado nos demais arquivos.

**Solução**: Removida a asserção de tipo em todas as ocorrências, alinhando com o padrão existente em `client.ts`.

**Arquivos alterados**:

- `src/features/insights/screens/InsightsDashboardScreen.tsx:16`
- `src/features/insights/screens/ReportDetailScreen.tsx:13`
- `src/infrastructure/sync/offline-queue.ts:7`
- `src/infrastructure/sync/sync-engine.ts:15`

**Impacto**: Zero impacto em runtime. Elimina 4 erros de lint que bloqueavam `pnpm lint`. Consistência com o padrão já adotado na camada de infraestrutura de API.

---

#### Problema 2: SQL injection em `clearSyncedRecords` (offline-db.ts)

**Causa raiz**: `db.execAsync()` recebia uma string com interpolação direta de `patientId` — ex: `WHERE patient_id = '${patientId}'`. O método `execAsync` do expo-sqlite 16.x não aceita parâmetros; a interpolação de string é SQL-injectable. Embora `patientId` seja um UUID gerado pelo servidor (risco prático baixo), viola o princípio de defense-in-depth e o Gate 2 da Constituição (segurança).

**Solução**: Substituídas as duas queries de `execAsync` com string interpolada por dois chamadas `runAsync` com placeholders `?` parametrizados — o mesmo padrão usado em todas as outras queries do arquivo.

**Arquivo alterado**: `src/infrastructure/storage/offline-db.ts:224-230`

**Impacto**: Elimina o vetor de SQL injection. Sem impacto em comportamento — `runAsync` executa a mesma operação de forma parametrizada e segura.

---

#### Problema 3: `pointerEvents` como prop View (deprecado no RN 0.71+ com New Architecture)

**Causa raiz**: Com `newArchEnabled: true` em `app.json` e React Native 0.81, a prop `pointerEvents` em componentes View/Animated.View foi movida para propriedade de estilo (deprecação iniciada no RN 0.71). Usando como prop, o renderer da New Architecture (Fabric) ignora o valor ou gera warnings, quebrando o comportamento de overlays não-interativos.

**Solução**:

- `Button.tsx`: Removida prop `pointerEvents="none"` de `<View>` e `<Animated.View>`; adicionado `pointerEvents: "none"` nos StyleSheet entries `shine` e `emGlow`.
- `app/auth/login.tsx`: DotGrid atualizado de `<View style={StyleSheet.absoluteFillObject} pointerEvents="none">` para `<View style={[StyleSheet.absoluteFillObject, { pointerEvents: "none" }]}>`.

**Arquivos alterados**:

- `src/design/components/ui/Button.tsx` (JSX + StyleSheet)
- `app/auth/login.tsx` (DotGrid component)

**Impacto**: Garante que os overlays decorativos (shine e emGlow no Button, dot grid no Login) não interceptem toques na New Architecture. Comportamento visual idêntico; compatibilidade com Fabric/RN 0.81 assegurada.

---

#### Stack atual confirmada após diagnóstico

| Pacote              | Versão em `package.json` | Status                          |
| ------------------- | ------------------------ | ------------------------------- |
| `expo`              | `~54.0.0`                | ✅ Compatível                   |
| `react-native`      | `0.81.5`                 | ✅ Compatível                   |
| `expo-router`       | `~6.0.23`                | ✅ Compatível (SDK 54)          |
| `expo-sqlite`       | `~16.0.10`               | ✅ API async usada corretamente |
| `expo-secure-store` | `~15.0.8`                | ✅ Keychain/Keystore correto    |
| `react`             | `19.1.0`                 | ✅ Compatível                   |
| `newArchEnabled`    | `true`                   | ✅ New Architecture ativa       |

#### Próximos passos recomendados

1. **Testes E2E em dispositivo físico**: Validar offline queue, sync engine e SQLite com New Architecture ativa (SQLCipher build do expo-sqlite 16.x).
2. **Audit de `execAsync` restante**: Confirmar que nenhuma outra chamada `execAsync` usa interpolação de string; apenas `initSchema` usa, com DDL estático seguro.
3. **Testes de regressão no Button**: Verificar que os overlays `shine` e `emGlow` continuam não-interativos com `pointerEvents` no style em dispositivos iOS físicos com RN 0.81.
4. **Adicionar `@sweetcare/mobile` ao lint do CI**: O `pnpm lint` no monorepo não executa o lint do mobile por padrão — verificar se `turbo.json` inclui a task `lint` para o package mobile.
