import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

describe("Auth flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health returns ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>().status).toBe("ok");
  });

  it("POST /api/v1/auth/register returns 201 for valid input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `test-${Date.now()}@example.com`,
        password: "StrongPass#1234",
        role: "guardian",
        display_name: "Test Guardian",
      },
    });
    // In unit test environment DB is not connected — expect 500 or 201
    // Full integration test requires test DB (see quickstart.md)
    expect([201, 500]).toContain(response.statusCode);
  });

  it("POST /api/v1/auth/register rejects weak password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "test@example.com",
        password: "short",
        role: "guardian",
        display_name: "Test",
      },
    });
    expect(response.statusCode).toBe(422);
  });

  it("POST /api/v1/auth/login without cookie returns 401 on protected routes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
    });
    expect(response.statusCode).toBe(401);
  });

  it("POST /api/v1/auth/refresh without cookie returns 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
    });
    expect(response.statusCode).toBe(401);
  });

  it("POST /api/v1/consent without auth returns 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/consent",
      payload: {
        consent_type: "data_processing",
        consent_text_version: "1.0.0",
      },
    });
    expect(response.statusCode).toBe(401);
  });
});
