import type { FastifyInstance } from "fastify";

// GET /metrics — Prometheus text format 0.0.4 using native Node.js process APIs.
// No external dependencies required. Exposes process-level metrics only.
// In production, restrict access to internal network / scrape credentials.
export default async function monitoringRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (_request, reply) => {
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    const lines: string[] = [
      "# HELP process_uptime_seconds Process uptime in seconds",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${uptime.toFixed(3)}`,
      "",
      "# HELP nodejs_heap_used_bytes JavaScript heap used in bytes",
      "# TYPE nodejs_heap_used_bytes gauge",
      `nodejs_heap_used_bytes ${String(mem.heapUsed)}`,
      "",
      "# HELP nodejs_heap_total_bytes JavaScript heap total in bytes",
      "# TYPE nodejs_heap_total_bytes gauge",
      `nodejs_heap_total_bytes ${String(mem.heapTotal)}`,
      "",
      "# HELP nodejs_rss_bytes Process resident set size in bytes",
      "# TYPE nodejs_rss_bytes gauge",
      `nodejs_rss_bytes ${String(mem.rss)}`,
      "",
      "# HELP nodejs_external_memory_bytes V8 external memory used by C++ objects in bytes",
      "# TYPE nodejs_external_memory_bytes gauge",
      `nodejs_external_memory_bytes ${String(mem.external)}`,
      "",
      "# HELP nodejs_version_info Node.js version information",
      "# TYPE nodejs_version_info gauge",
      `nodejs_version_info{version="${process.version}"} 1`,
      "",
    ];

    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return reply.status(200).send(lines.join("\n"));
  });
}
