import IORedis from "ioredis";

const redis = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, enableOfflineQueue: false })
  : null;
if (redis) redis.on("error", () => {});
let redisHealthy = Boolean(redis);

type LocalMetrics = {
  counters: Map<string, number>;
  gauges: Map<string, number>;
};

const localMetrics: LocalMetrics = {
  counters: new Map(),
  gauges: new Map()
};

const METRICS_HASH = "luxefinder:metrics";
const WORKER_HEARTBEAT_KEY = "luxefinder:worker:heartbeat";

export async function incrementMetric(name: string, by = 1): Promise<void> {
  if (redis && redisHealthy) {
    try {
      await redis.hincrby(METRICS_HASH, name, by);
      return;
    } catch {
      redisHealthy = false;
    }
  }
  localMetrics.counters.set(name, (localMetrics.counters.get(name) ?? 0) + by);
}

export async function setGauge(name: string, value: number): Promise<void> {
  if (redis && redisHealthy) {
    try {
      await redis.hset(METRICS_HASH, name, String(value));
      return;
    } catch {
      redisHealthy = false;
    }
  }
  localMetrics.gauges.set(name, value);
}

export async function setWorkerHeartbeat(workerName: string): Promise<void> {
  const payload = JSON.stringify({
    worker: workerName,
    timestamp: new Date().toISOString()
  });
  if (redis && redisHealthy) {
    try {
      await redis.set(WORKER_HEARTBEAT_KEY, payload, "EX", 45);
      return;
    } catch {
      redisHealthy = false;
    }
  }
  localMetrics.gauges.set("worker_heartbeat_epoch_ms", Date.now());
}

export async function getWorkerHeartbeat(): Promise<{ worker: string; timestamp: string } | null> {
  if (redis && redisHealthy) {
    try {
      const value = await redis.get(WORKER_HEARTBEAT_KEY);
      if (!value) return null;
      return JSON.parse(value) as { worker: string; timestamp: string };
    } catch {
      redisHealthy = false;
    }
  }
  const ts = localMetrics.gauges.get("worker_heartbeat_epoch_ms");
  if (!ts) return null;
  return { worker: "local", timestamp: new Date(ts).toISOString() };
}

export async function getMetricsSnapshot(): Promise<Record<string, number>> {
  if (redis && redisHealthy) {
    try {
      const hash = await redis.hgetall(METRICS_HASH);
      const result: Record<string, number> = {};
      Object.entries(hash).forEach(([key, value]) => {
        const parsed = Number(value);
        result[key] = Number.isFinite(parsed) ? parsed : 0;
      });
      return result;
    } catch {
      redisHealthy = false;
    }
  }
  const output: Record<string, number> = {};
  for (const [key, value] of localMetrics.counters.entries()) output[key] = value;
  for (const [key, value] of localMetrics.gauges.entries()) output[key] = value;
  return output;
}
