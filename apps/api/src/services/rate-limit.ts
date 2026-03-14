import IORedis from "ioredis";
import { sleep } from "./retry";

const redis = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, enableOfflineQueue: false })
  : null;
if (redis) redis.on("error", () => {});
let redisHealthy = Boolean(redis);

export function parseRateLimitWaitMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  if (!error.message.startsWith("rate_limited:")) return null;
  const value = Number(error.message.split(":")[1]);
  return Number.isFinite(value) ? value : null;
}

async function claimSlot(platform: string, perMinute: number): Promise<void> {
  if (!redis || !redisHealthy || perMinute <= 0) return;
  const minuteBucket = Math.floor(Date.now() / 60000);
  const key = `ratelimit:${platform}:${minuteBucket}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 65);
    if (count <= perMinute) return;
    const ttlSeconds = await redis.ttl(key);
    const waitMs = Math.max((ttlSeconds > 0 ? ttlSeconds : 1) * 1000, 1000);
    throw new Error(`rate_limited:${waitMs}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("rate_limited:")) {
      throw error;
    }
    redisHealthy = false;
  }
}

export async function waitForRateLimitSlot(platform: string, perMinute: number): Promise<void> {
  try {
    await claimSlot(platform, perMinute);
  } catch (error) {
    const waitMs = parseRateLimitWaitMs(error);
    if (waitMs === null) throw error;
    await sleep(waitMs);
    await claimSlot(platform, perMinute);
  }
}
