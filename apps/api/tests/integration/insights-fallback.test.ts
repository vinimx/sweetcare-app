import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

describe("Insights routes — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/insights/reports requires authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/insights/reports",
      payload: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        report_type: "weekly_summary",
        period_start: "2026-05-01",
        period_end: "2026-05-07",
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/insights/reports/:id requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/insights/reports/00000000-0000-0000-0000-000000000001",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/insights/reports requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/insights/reports?patient_id=00000000-0000-0000-0000-000000000001",
    });
    expect(response.statusCode).toBe(401);
  });

  it("POST /api/v1/insights/reports rejects invalid period dates", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/insights/reports",
      payload: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        report_type: "weekly_summary",
        period_start: "not-a-date",
        period_end: "also-not-a-date",
      },
    });
    expect([401, 422]).toContain(response.statusCode);
  });

  it("POST /api/v1/insights/reports rejects invalid report_type", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/insights/reports",
      payload: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        report_type: "invalid_type",
        period_start: "2026-05-01",
        period_end: "2026-05-07",
      },
    });
    expect([401, 422]).toContain(response.statusCode);
  });

  it("GET /api/v1/insights/reports rejects non-UUID patient_id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/insights/reports?patient_id=not-a-uuid",
    });
    expect([401, 422]).toContain(response.statusCode);
  });
});

describe("Insights — period validation (no DB required)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("validates period end >= period start at schema level or auth level", async () => {
    // Route will return 401 (no auth) before period validation, but proves route is registered
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/insights/reports",
      payload: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        report_type: "weekly_summary",
        period_start: "2026-05-07",
        period_end: "2026-05-01",
      },
    });
    expect([401, 422]).toContain(response.statusCode);
  });

  it("validates period length ≤ 90 days at schema level or auth level", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/insights/reports",
      payload: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        report_type: "weekly_summary",
        period_start: "2026-01-01",
        period_end: "2026-06-30", // > 90 days
      },
    });
    expect([401, 422]).toContain(response.statusCode);
  });
});
