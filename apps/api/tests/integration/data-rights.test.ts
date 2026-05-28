import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

describe("Data rights routes (LGPD)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/users/me/data-export without auth returns 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users/me/data-export",
    });
    expect(response.statusCode).toBe(401);
  });

  it("DELETE /api/v1/users/me without auth returns 401", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/me",
      payload: { password: "somepassword" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("DELETE /api/v1/users/me without body returns 422 (schema validation precedes preHandler)", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/me",
    });
    // Fastify runs schema validation before preHandler hooks — body is validated first
    expect(response.statusCode).toBe(422);
  });
});
