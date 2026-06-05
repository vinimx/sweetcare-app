import { Redis } from "ioredis";
import { logger } from "../logging/logger.js";

let instance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!instance) {
    instance = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    instance.on("error", (err: Error) => {
      logger.warn({ err: err.message }, "Redis connection error");
    });
  }
  return instance;
}

export async function closeRedisClient(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = null;
  }
}
