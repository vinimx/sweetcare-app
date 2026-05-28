# Performance Baseline — SweetCare API

**Target**: p95 latency ≤ 300 ms on critical endpoints under representative load  
**Date**: 2026-05-28  
**Environment**: Docker Compose dev stack (local — not production hardware)

---

## Targets from Specification

Per `quickstart.md` and Constitution Gate 5:

| Endpoint                                    | Method                     | p95 Target | Criticality     |
| ------------------------------------------- | -------------------------- | ---------- | --------------- |
| `POST /api/v1/patients/:id/insulin-records` | Sync write                 | ≤ 300 ms   | Safety-critical |
| `POST /api/v1/patients/:id/symptoms`        | Sync write + alert eval    | ≤ 300 ms   | Safety-critical |
| `GET /api/v1/patients/:id/timeline`         | Read + merge               | ≤ 300 ms   | High            |
| `POST /api/v1/sync/batch`                   | Batch upsert (100 records) | ≤ 1000 ms  | Medium          |
| `GET /api/v1/health`                        | Health check               | ≤ 20 ms    | Low             |

---

## Methodology

### Tool

`autocannon` or `k6` against a locally running Docker Compose stack.

### Baseline load profile

```bash
# Install autocannon globally
npm install -g autocannon

# Health check baseline
autocannon -c 10 -d 30 http://localhost:3000/api/v1/health

# Authenticated endpoint (requires valid JWT in AUTH_TOKEN env)
autocannon -c 10 -d 30 \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -m GET \
  "http://localhost:3000/api/v1/patients/$PATIENT_ID/timeline"
```

### Load parameters

- **Connections**: 10 concurrent
- **Duration**: 30 seconds
- **Warm-up**: 5 seconds discarded
- **Data fixture**: patient with 30 insulin records + 20 symptom records

---

## Architectural factors affecting latency

| Layer                                       | Expected contribution | Mitigation                                                   |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| Network (localhost)                         | < 1 ms                | —                                                            |
| Fastify routing + Zod validation            | 2–5 ms                | Schema compilation at startup                                |
| Prisma query (indexed)                      | 5–30 ms               | Indices on `patient_profile_id`, `applied_at`, `observed_at` |
| PHI decrypt (AES-256-GCM per field)         | 0.5–2 ms              | Minimal fields per response                                  |
| argon2id password hash                      | 200–400 ms            | **Only on login** — not on record operations                 |
| Alert rule engine                           | < 1 ms                | Pure function, no I/O                                        |
| AI service proxy (`POST /insights/reports`) | 15–30 s               | Async (202) — not in p95 scope                               |

---

## Expected results (Docker Compose dev, local hardware)

> Values below are projections based on implementation analysis.
> Replace with measured values after running the benchmark suite.

| Endpoint                         | p50 (est.) | p95 (est.) | p99 (est.) | Target  | Status           |
| -------------------------------- | ---------- | ---------- | ---------- | ------- | ---------------- |
| `GET /health`                    | 1 ms       | 3 ms       | 5 ms       | 20 ms   | ✅ Expected pass |
| `POST /insulin-records` (single) | 15 ms      | 40 ms      | 80 ms      | 300 ms  | ✅ Expected pass |
| `POST /symptoms` (with alert)    | 20 ms      | 60 ms      | 120 ms     | 300 ms  | ✅ Expected pass |
| `GET /timeline` (50 records)     | 20 ms      | 55 ms      | 100 ms     | 300 ms  | ✅ Expected pass |
| `POST /sync/batch` (100 records) | 150 ms     | 400 ms     | 700 ms     | 1000 ms | ✅ Expected pass |
| `GET /metrics`                   | < 1 ms     | 2 ms       | 3 ms       | —       | —                |

---

## How to run and record actual results

```bash
# 1. Start the full dev stack
docker compose -f infra/docker/compose.dev.yml --profile api up -d

# 2. Obtain a valid access token
AUTH_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPass#1234"}' \
  | jq -r '.access_token')

# 3. Create a patient and record PATIENT_ID
PATIENT_ID=<uuid from POST /api/v1/patients>

# 4. Run benchmarks
npx autocannon -c 10 -d 30 \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "http://localhost:3000/api/v1/patients/$PATIENT_ID/timeline"

# 5. Record p50, p95, p99, requests/sec in the table above
```

---

## Production readiness notes

- PostgreSQL connection pool: `DATABASE_POOL_MAX=10` (configurable via env)
- Redis rate-limit store: global max 100 req/15min (configurable)
- Fastify `bodyLimit: 1_048_576` (1 MB) prevents large-payload DoS
- AI service isolated behind circuit breaker — outage does not affect p95 of core endpoints
- PHI decryption is synchronous and low-overhead; not a bottleneck at this scale
- For production, enable PostgreSQL query plan analysis (`EXPLAIN ANALYZE`) on slow queries
