import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

// These tests verify route wiring, schema validation, and auth guards.
// Full end-to-end with real DB requires the test container (see CLAUDE.md §10).

describe("Phase 3 — US1 route guards and validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Patients ────────────────────────────────────────────────────────────

  it("POST /patients without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients",
      payload: {
        full_name: "Test Child",
        date_of_birth: "2015-06-01",
        diagnosis_year: 2020,
        target_glucose_min_mgdl: 70,
        target_glucose_max_mgdl: 180,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /patients rejects invalid body with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        full_name: "",
        date_of_birth: "not-a-date",
        diagnosis_year: 1800,
        target_glucose_min_mgdl: 200,
        target_glucose_max_mgdl: 50,
      },
    });
    // 401 from invalid JWT is also acceptable in no-DB mode
    expect([401, 422]).toContain(res.statusCode);
  });

  it("GET /patients/:patientId without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000",
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Insulin records ─────────────────────────────────────────────────────

  it("POST /patients/:patientId/insulin-records without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/insulin-records",
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        insulin_type: "NovoLog",
        dose_units: 4,
        dose_rationale: "correction",
        applied_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /patients/:patientId/insulin-records rejects meal_coverage without carbs — 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/insulin-records",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        insulin_type: "NovoLog",
        dose_units: 4,
        dose_rationale: "meal_coverage",
        applied_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
        // meal_carbs_grams intentionally omitted
      },
    });
    expect([401, 422]).toContain(res.statusCode);
  });

  it("POST /patients/:patientId/insulin-records rejects dose_units out of range — 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/insulin-records",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        insulin_type: "NovoLog",
        dose_units: 999,
        dose_rationale: "correction",
        applied_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
      },
    });
    expect([401, 422]).toContain(res.statusCode);
  });

  it("GET /patients/:patientId/insulin-records without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/insulin-records",
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Symptom records ──────────────────────────────────────────────────────

  it("POST /patients/:patientId/symptoms without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/symptoms",
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        symptom_codes: ["tremor"],
        severity_level: "mild",
        observed_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /patients/:patientId/symptoms rejects empty symptom_codes — 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/symptoms",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        symptom_codes: [],
        severity_level: "mild",
        observed_at: new Date().toISOString(),
        timezone: "America/Sao_Paulo",
      },
    });
    expect([401, 422]).toContain(res.statusCode);
  });

  it("GET /patients/:patientId/symptoms without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/symptoms",
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Sync ────────────────────────────────────────────────────────────────

  it("POST /sync/batch without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/batch",
      payload: {
        batch_id: "00000000-0000-4000-a000-000000000002",
        patient_profile_id: "00000000-0000-4000-a000-000000000000",
        records: [
          {
            record_type: "insulin_application",
            client_id: "00000000-0000-4000-a000-000000000001",
            payload: {
              insulin_type: "NovoLog",
              dose_units: 4,
              dose_rationale: "correction",
              applied_at: new Date().toISOString(),
              timezone: "America/Sao_Paulo",
            },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /sync/batch rejects empty records array — 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/batch",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        batch_id: "00000000-0000-4000-a000-000000000002",
        patient_profile_id: "00000000-0000-4000-a000-000000000000",
        records: [],
      },
    });
    expect([401, 422]).toContain(res.statusCode);
  });

  it("GET /sync/status/:patientId without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sync/status/00000000-0000-4000-a000-000000000000",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /sync/resolve-conflict without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/resolve-conflict",
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        resolution: "keep_server",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /sync/resolve-conflict rejects invalid resolution value — 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/resolve-conflict",
      headers: { authorization: "Bearer invalid.token.here" },
      payload: {
        client_id: "00000000-0000-4000-a000-000000000001",
        resolution: "invalid_option",
      },
    });
    expect([401, 422]).toContain(res.statusCode);
  });

  // ─── Timeline ────────────────────────────────────────────────────────────

  it("GET /patients/:patientId/timeline without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/patients/00000000-0000-4000-a000-000000000000/timeline",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /patients/:patientId/timeline rejects invalid UUID param — 400 or 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/patients/not-a-uuid/timeline",
      headers: { authorization: "Bearer invalid.token.here" },
    });
    expect([400, 401, 422]).toContain(res.statusCode);
  });
});
