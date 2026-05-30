# SweetCare

**Safety-critical mobile platform for caregivers of children with Type 1 Diabetes Mellitus (T1DM).**

SweetCare enables secure logging of insulin doses and symptoms, rule-based emergency alerts, AI-assisted statistical insights, and full offline operation with encrypted sync — built with LGPD compliance (Brazilian data protection law) and WCAG 2.1 AA accessibility from the ground up.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Security Model](#security-model)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [Running Tests](#running-tests)
9. [Monitoring](#monitoring)
10. [API Reference](#api-reference)

---

## What it does

| Feature                       | Description                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Insulin & symptom logging** | Full CRUD with offline queue — records saved to encrypted SQLite when offline, synced automatically on reconnect                                                                        |
| **Emergency alerts**          | Rule engine evaluates 5 clinical rules synchronously on every symptom record; emergency alerts surface immediately with step-by-step guidance and emergency contacts                    |
| **AI insights**               | Statistical analysis of 30-day patterns (glucose, insulin, symptoms) via isolated FastAPI microservice; reports rendered with confidence distribution charts and share-to-doctor export |
| **Offline-first**             | SQLite + React Query persist; sync batch API with conflict resolution and idempotency via UUIDv4 `client_id`                                                                            |
| **Multi-patient**             | One account manages multiple patient profiles; RBAC with guardian / caregiver / read-only / healthcare professional roles                                                               |
| **LGPD compliance**           | Data export (`GET /users/me/data-export`) and right-to-erasure (`DELETE /users/me`) endpoints; explicit consent tracking per processing purpose                                         |
| **Observability**             | Prometheus metrics endpoint + Grafana dashboard; structured Pino logs with PHI redaction; correlation ID on every response                                                              |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile (Expo SDK 54 / React Native 0.81)                       │
│  • Expo Router 6 — file-based navigation (New Architecture)     │
│  • React Query 5 — server state + offline mutation queue        │
│  • SQLite (expo-sqlite 16) — encrypted offline PHI storage      │
│  • expo-secure-store — tokens (iOS Keychain / Android Keystore) │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / TLS 1.3
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (Fastify 5 / TypeScript / Node.js 20 LTS)                  │
│  • Zod schema-first validation + type provider                  │
│  • JWT access tokens (15 min) + opaque refresh (7 days)         │
│  • Prisma 6 + AES-256-GCM per-field PHI encryption              │
│  • Pino structured logging — 15 PHI paths redacted              │
└──────────┬──────────────────────────┬───────────────────────────┘
           │ PostgreSQL               │ HTTP (internal network only)
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────────────────┐
│  PostgreSQL 16   │      │  AI Service (FastAPI / Python 3.12)  │
│  • pgcrypto      │      │  • Isolated internal Docker network  │
│  • Row Level     │      │  • Receives aggregated metrics only  │
│    Security      │      │  • PHI never enters this service     │
│  • Immutability  │      │  • scikit-learn statistical analysis │
│    triggers      │      └──────────────────────────────────────┘
│  • pgaudit       │
└────────┬─────────┘
         │
┌────────┴─────────┐
│  Redis 7         │
│  • Session cache │
│  • Rate limiting │
└──────────────────┘
```

### Key architectural principles

| Principle                  | Implementation                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Safety-critical first**  | Medical records immutable in DB (triggers); emergency alerts created synchronously in same transaction as symptom record |
| **Defense-in-depth**       | TLS → RBAC → Row Level Security → AES-256-GCM field encryption → append-only audit trail                                 |
| **PHI zero-trust in logs** | Pino redaction — correlation UUIDs only, zero clinical data in log output                                                |
| **Offline-first**          | SQLite + React Query queue; sync API with batch processing, conflict detection, and idempotent upserts                   |
| **AI isolation**           | FastAPI receives only aggregated statistical metrics; Fastify proxy strips all PHI before forwarding                     |
| **Immutability**           | PostgreSQL `BEFORE UPDATE OR DELETE` triggers on all medical record tables; `AuditEntry` table is append-only            |

---

## Tech Stack

### Backend — `apps/api`

| Technology                  | Version | Role                               |
| --------------------------- | ------- | ---------------------------------- |
| Node.js                     | 20 LTS  | Runtime                            |
| TypeScript                  | 5.7     | Language                           |
| Fastify                     | 5.2     | HTTP framework                     |
| `fastify-type-provider-zod` | 4.0     | Schema-first validation            |
| `@fastify/jwt`              | 9.0     | Access tokens (HS256, 15 min)      |
| `@fastify/cookie`           | 11.0    | Refresh token HttpOnly cookie      |
| `@fastify/helmet`           | 13.0    | Security headers (CSP, HSTS 2y)    |
| `@fastify/rate-limit`       | 10.1    | Brute-force protection             |
| Prisma                      | 6.1     | ORM + PHI encryption extension     |
| PostgreSQL                  | 16      | Primary DB + pgcrypto + RLS        |
| Redis                       | 7       | Session cache + rate limiting      |
| Zod                         | 3.23    | Runtime schema validation          |
| Pino                        | 9.5     | Structured logging + PHI redaction |
| argon2 (argon2id)           | 0.41    | Password hashing (64 MB, 3 iter)   |

### Mobile — `apps/mobile`

| Technology              | Version | Role                                |
| ----------------------- | ------- | ----------------------------------- |
| React Native            | 0.81    | Mobile framework (New Architecture) |
| Expo SDK                | 54      | Build toolchain + native APIs       |
| Expo Router             | 6.0     | File-based navigation               |
| `expo-secure-store`     | 15      | Token storage (Keychain / Keystore) |
| `expo-sqlite`           | 16      | Offline DB (SQLCipher)              |
| `@tanstack/react-query` | 5.62    | Server state + offline mutations    |
| `react-hook-form`       | 7.54    | Form validation                     |
| Zod                     | 3.23    | Shared schema validation            |

### AI Service — `apps/ai-service`

| Technology     | Version    | Role                           |
| -------------- | ---------- | ------------------------------ |
| Python         | 3.12       | Runtime                        |
| FastAPI        | 0.115      | HTTP framework                 |
| Pydantic       | 2.10       | Schema validation              |
| NumPy / pandas | 2.2        | Numerical analysis             |
| scikit-learn   | 1.6        | Statistical pattern detection  |
| structlog      | 24.4       | Structured logging             |
| ruff + mypy    | 0.8 / 1.13 | Linting + strict type checking |

### Tooling — monorepo root

| Technology          | Version    | Role                                |
| ------------------- | ---------- | ----------------------------------- |
| pnpm                | 9.15       | Package manager (strict hoisting)   |
| Turborepo           | 2.3        | Build orchestration + cache         |
| ESLint              | 9.17       | Linting (flat config, strict)       |
| Prettier            | 3.4        | Code formatting                     |
| Vitest              | 2.1        | Test runner (API + shared packages) |
| pytest              | 8.3        | Test runner (AI service)            |
| Husky + lint-staged | 9.1 / 15.2 | Pre-commit hooks                    |

---

## Project Structure

```
sweetcare-app/
├── packages/
│   ├── shared-types/          # TypeScript domain types (no runtime deps)
│   ├── shared-validation/     # Shared Zod schemas (API + mobile)
│   └── shared-config/         # Env schemas + domain constants
│
├── apps/
│   ├── api/                   # Fastify 5 API
│   │   ├── prisma/            # Schema (11 entities, 13 enums) + RLS SQL
│   │   ├── src/
│   │   │   ├── domain/        # Entities + pure business rules
│   │   │   ├── application/   # Services, audit, auth
│   │   │   ├── infrastructure/# DB, JWT, session, AI client, logging
│   │   │   └── presentation/  # Routes (14 route files)
│   │   └── tests/             # Integration tests (49 cases)
│   │
│   ├── mobile/                # Expo SDK 54 / React Native 0.81
│   │   ├── app/               # Expo Router pages
│   │   │   ├── (tabs)/        # Main tabs: Home, Log, Insights, Profile
│   │   │   ├── auth/          # Login + Register
│   │   │   ├── patients/      # Create + Edit patient profile
│   │   │   ├── records/       # Insulin + Symptom detail + edit
│   │   │   └── alerts/        # Alert detail + resolve
│   │   └── src/
│   │       ├── design/        # Design system (tokens, components, theme)
│   │       ├── features/      # Feature screens (insulin, symptoms, insights, sync)
│   │       └── infrastructure/# API client, auth context, offline DB, sync engine
│   │
│   └── ai-service/            # FastAPI microservice
│       ├── app/
│       │   ├── api/           # POST /v1/analyze
│       │   ├── schemas/       # Pydantic request/response models
│       │   └── services/      # 5 statistical detectors + confidence scoring
│       └── tests/             # Contract tests (13 cases)
│
└── infra/
    ├── docker/
    │   ├── compose.dev.yml        # postgres + redis + ai-service
    │   └── compose.monitoring.yml # Prometheus + Grafana (opt-in)
    └── monitoring/
        ├── prometheus.yml
        └── grafana/dashboards/    # 5-panel memory + uptime dashboard
```

---

## Security Model

### Layers of protection

```
HTTPS / TLS 1.3
    └── HSTS 2 years + full CSP (frameAncestors, formAction)
        └── JWT HS256 15-min access + 7-day opaque refresh
            └── argon2id password hashing (64 MB, 3 iter, parallelism=1)
                └── Refresh token family invalidation (theft detection)
                    └── RBAC (guardian / caregiver / read_only / admin)
                        └── CaregiverAssignment verification per request
                            └── Row Level Security (has_patient_access())
                                └── AES-256-GCM per PHI field (Prisma $extends)
                                    └── Append-only AuditEntry table
                                        └── Immutability triggers (UPDATE/DELETE blocked)
```

### LGPD Art. 14 (children's data) compliance

| Requirement        | Implementation                                                |
| ------------------ | ------------------------------------------------------------- |
| Guardian consent   | `ConsentRecord` created atomically with `PatientProfile`      |
| Consent revocation | `DELETE /consent/:id` freezes data processing immediately     |
| Data minimization  | Only clinically necessary fields collected                    |
| Right of access    | `GET /users/me/data-export` returns full data export          |
| Right to erasure   | `DELETE /users/me` anonymizes user + cascades patient records |

### AI service PHI isolation

The AI service runs on an **internal-only Docker network** (`internal: true`). The Fastify API strips all PHI before forwarding to `/v1/analyze` — only aggregated statistical metrics (glucose values, insulin doses, symptom codes without patient context) are sent. PHI never enters Python territory.

---

## Getting Started

### Prerequisites

- **Node.js** 20 LTS
- **pnpm** 9.x → `npm install -g pnpm`
- **Docker Desktop** (PostgreSQL 16, Redis 7, AI service)
- **Python** 3.12 + **uv** → `pip install uv` (only needed to run AI service locally outside Docker)
- **Expo Go** or a simulator/emulator for mobile testing

### 1. Clone the repository

```bash
git clone https://github.com/vinimx/sweetcare-app.git
cd sweetcare-app
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
# API
cp apps/api/.env.example apps/api/.env

# Mobile
cp apps/mobile/.env.example apps/mobile/.env.local

# AI service
cp apps/ai-service/.env.example apps/ai-service/.env
```

Generate secrets for `apps/api/.env`:

```bash
# PHI_ENCRYPTION_KEY — 32 bytes, must be exactly 64 hex chars
openssl rand -hex 32

# JWT_ACCESS_SECRET and JWT_REFRESH_SECRET — use different values
openssl rand -hex 32
openssl rand -hex 32
```

Minimum required values in `apps/api/.env`:

```env
DATABASE_URL=postgresql://sweetcare:changeme@127.0.0.1:5433/sweetcare_dev
REDIS_URL=redis://:changeme_redis@127.0.0.1:6379
JWT_ACCESS_SECRET=<64-hex-chars>
JWT_REFRESH_SECRET=<64-hex-chars-different-from-above>
PHI_ENCRYPTION_KEY=<64-hex-chars>
NODE_ENV=development
```

> ⚠️ **PHI_ENCRYPTION_KEY**: losing this key means permanent loss of all encrypted medical records. In production, store it in AWS Secrets Manager or HashiCorp Vault.

### 4. Start the infrastructure

```bash
docker compose -f infra/docker/compose.dev.yml up -d
```

This starts PostgreSQL 16 (port **5433**), Redis 7 (port **6379**), and the AI service (port **8000**).

Verify all containers are healthy:

```bash
docker compose -f infra/docker/compose.dev.yml ps
```

### 5. Set up the database

```bash
# Generate Prisma client
pnpm --filter "@sweetcare/api" db:generate

# Run migrations
pnpm --filter "@sweetcare/api" db:migrate

# Apply RLS policies and immutability triggers (run once)
docker exec -i sweetcare-postgres psql -U sweetcare -d sweetcare_dev \
  < apps/api/prisma/manual/rls-policies.sql
```

### 6. Build shared packages

```bash
pnpm --filter "@sweetcare/shared-*" build
```

### 7. Start the API

```bash
pnpm --filter "@sweetcare/api" dev
```

The API will be available at `http://localhost:3000`. Health check: `GET /api/v1/health`.

### 8. Start the mobile app

```bash
pnpm --filter "@sweetcare/mobile" start
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to your machine's local IP (not `localhost`) so the Expo app on a physical device can reach the API:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
```

Scan the QR code with **Expo Go** or press `i` for iOS simulator / `a` for Android emulator.

### Running on a physical iOS device (full stack test)

```bash
# 1. Start infra + API as above
# 2. Open the Expo app on your iPhone
pnpm --filter "@sweetcare/mobile" start
# 3. Scan QR code with the Camera app or Expo Go
```

---

## Environment Variables

### `apps/api/.env`

| Variable             | Required | Default                 | Description                                          |
| -------------------- | -------- | ----------------------- | ---------------------------------------------------- |
| `DATABASE_URL`       | **Yes**  | —                       | PostgreSQL connection string (port 5433 with Docker) |
| `JWT_ACCESS_SECRET`  | **Yes**  | —                       | Min 32 chars, HS256 signing key                      |
| `JWT_REFRESH_SECRET` | **Yes**  | —                       | Min 32 chars, different from access secret           |
| `PHI_ENCRYPTION_KEY` | **Yes**  | —                       | 64 hex chars (32 bytes) for AES-256-GCM              |
| `REDIS_URL`          | **Yes**  | —                       | Redis connection string                              |
| `NODE_ENV`           | **Yes**  | —                       | `development` \| `test` \| `production`              |
| `PORT`               | No       | `3000`                  | HTTP bind port                                       |
| `AI_SERVICE_URL`     | No       | `http://localhost:8000` | Internal AI service URL                              |
| `LOG_LEVEL`          | No       | `info`                  | `trace` \| `debug` \| `info` \| `warn` \| `error`    |

### `apps/mobile/.env.local`

| Variable              | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Full base URL of the API (e.g. `http://192.168.1.5:3000/api/v1`) |
| `EXPO_PUBLIC_ENV`     | `development` \| `staging` \| `production`                       |

---

## Running Tests

```bash
# All tests across the monorepo
pnpm test

# API integration tests with coverage (threshold: 80%)
pnpm --filter "@sweetcare/api" test:coverage

# API tests in watch mode
pnpm --filter "@sweetcare/api" test:watch

# AI service contract tests
cd apps/ai-service && pytest -v

# Lint + typecheck
pnpm lint
pnpm typecheck
```

### Test coverage

| Layer               | Framework     | Tests                                         | Status           |
| ------------------- | ------------- | --------------------------------------------- | ---------------- |
| API integration     | Vitest        | 49 cases (auth, sync, alerts, insights, LGPD) | ✅               |
| AI service contract | pytest        | 13 cases (schema, PHI isolation, findings)    | ✅               |
| Mobile components   | Vitest + RNTL | —                                             | Planned post-MVP |
| E2E mobile          | Detox         | —                                             | Planned post-MVP |

---

## Monitoring

The monitoring stack is **optional** and runs separately from the dev infra:

```bash
docker compose -f infra/docker/compose.monitoring.yml up -d
```

| Service    | URL                   | Credentials      |
| ---------- | --------------------- | ---------------- |
| Grafana    | http://localhost:3001 | admin / changeme |
| Prometheus | http://localhost:9090 | —                |

The API exposes Prometheus-format metrics at `GET /api/v1/metrics` (no external dependencies — uses `process.memoryUsage()` + `process.uptime()`). The Grafana dashboard includes 5 panels: uptime, heap used, RSS, heap timeseries, and process memory.

---

## API Reference

All endpoints are prefixed with `/api/v1`. Every response includes `X-Correlation-Id` and `X-API-Version: 1`.

### Auth

| Method   | Endpoint         | Auth           | Description                            |
| -------- | ---------------- | -------------- | -------------------------------------- |
| `POST`   | `/auth/register` | —              | Register + auto-login (returns tokens) |
| `POST`   | `/auth/login`    | —              | Login (access token + refresh cookie)  |
| `POST`   | `/auth/refresh`  | Cookie or body | Rotate refresh token                   |
| `POST`   | `/auth/logout`   | Bearer         | Invalidate session family              |
| `GET`    | `/users/me`      | Bearer         | Get current user                       |
| `POST`   | `/consent`       | Bearer         | Grant consent (e.g. `ai_analysis`)     |
| `DELETE` | `/consent/:id`   | Bearer         | Revoke consent                         |

### Patients & Medical Records

| Method   | Endpoint                             | Auth                | Description                              |
| -------- | ------------------------------------ | ------------------- | ---------------------------------------- |
| `POST`   | `/patients`                          | Bearer              | Create patient profile                   |
| `GET`    | `/patients/:id`                      | Bearer + assignment | Get patient profile                      |
| `POST`   | `/patients/:id/insulin-records`      | Bearer + write      | Log insulin dose                         |
| `GET`    | `/patients/:id/insulin-records`      | Bearer + assignment | List insulin records                     |
| `PATCH`  | `/patients/:id/insulin-records/:rid` | Bearer + write      | Update record                            |
| `DELETE` | `/patients/:id/insulin-records/:rid` | Bearer + write      | Delete record                            |
| `POST`   | `/patients/:id/symptoms`             | Bearer + write      | Log symptom (triggers alert rule engine) |
| `GET`    | `/patients/:id/symptoms`             | Bearer + assignment | List symptom records                     |
| `GET`    | `/patients/:id/timeline`             | Bearer + assignment | Merged insulin + symptom timeline        |

### Sync (Offline)

| Method | Endpoint                  | Description                                  |
| ------ | ------------------------- | -------------------------------------------- |
| `POST` | `/sync/batch`             | Submit offline queue batch (max 100 records) |
| `GET`  | `/sync/status/:patientId` | Check sync status                            |
| `POST` | `/sync/resolve-conflict`  | Resolve sync conflict                        |

### Alerts

| Method  | Endpoint               | Description                          |
| ------- | ---------------------- | ------------------------------------ |
| `GET`   | `/patients/:id/alerts` | List patient alerts                  |
| `GET`   | `/alerts/:id`          | Get alert detail with guidance steps |
| `PATCH` | `/alerts/:id/resolve`  | Mark alert resolved                  |

### AI Insights

| Method | Endpoint                | Description                                     |
| ------ | ----------------------- | ----------------------------------------------- |
| `POST` | `/insights/reports`     | Request AI analysis report (async, returns 202) |
| `GET`  | `/insights/reports/:id` | Poll report status or retrieve completed report |
| `GET`  | `/insights/reports`     | List reports for a patient                      |

### LGPD Data Rights

| Method   | Endpoint                | Description                                     |
| -------- | ----------------------- | ----------------------------------------------- |
| `GET`    | `/users/me/data-export` | Export all personal data (LGPD Art. 18)         |
| `DELETE` | `/users/me`             | Delete account (requires password confirmation) |

### Ops

| Method | Endpoint   | Description        |
| ------ | ---------- | ------------------ |
| `GET`  | `/health`  | Liveness check     |
| `GET`  | `/ready`   | Readiness check    |
| `GET`  | `/metrics` | Prometheus metrics |

---

## Common Commands

```bash
# Infrastructure
docker compose -f infra/docker/compose.dev.yml up -d        # Start postgres + redis + ai-service
docker compose -f infra/docker/compose.dev.yml down -v      # Stop + delete volumes
docker compose -f infra/docker/compose.dev.yml logs -f      # Stream logs

# Database
pnpm --filter "@sweetcare/api" db:studio                    # Open Prisma Studio (localhost:5555)
pnpm --filter "@sweetcare/api" db:migrate                   # Run pending migrations

# Build
pnpm build                                                  # Build all packages + apps
pnpm --filter "@sweetcare/shared-*" build                   # Rebuild shared packages

# Mobile
pnpm --filter "@sweetcare/mobile" ios                       # Run on iOS simulator
pnpm --filter "@sweetcare/mobile" android                   # Run on Android emulator
```

---

## Domain Model

```
User (guardian) ──< CaregiverAssignment >── PatientProfile
User (guardian) ──< ConsentRecord ──────── PatientProfile
PatientProfile  ──< InsulinApplicationRecord ── AuditEntry
PatientProfile  ──< SymptomRecord ──────────── AlertEvent ── AuditEntry
PatientProfile  ──< InsightReport
User            ──< UserSession   (token families with theft detection)
```

**Clinical invariants enforced at the API layer:**

- Insulin dose: `0.01 ≤ units ≤ 100`
- Glucose readings: `20 ≤ mg/dL ≤ 600`
- Record timestamps: no more than 5 minutes in the future
- Emergency symptoms → alert created synchronously in same DB transaction

---

## License

This is a portfolio project. All rights reserved.
