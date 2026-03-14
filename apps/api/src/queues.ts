import { Queue } from "bullmq";
import { processSearch } from "./services/search-pipeline";

const hasRedis = Boolean(process.env.REDIS_URL);
export const SEARCH_QUEUE_NAME = "search-jobs";
export const SEARCH_DLQ_NAME = "search-jobs-dlq";

export const redisConnection = hasRedis ? { url: process.env.REDIS_URL as string } : null;

export const searchQueue = redisConnection
  ? new Queue<{ searchId: string }, void, "process-search">(SEARCH_QUEUE_NAME, { connection: redisConnection })
  : null;

export const searchDlq = redisConnection
  ? new Queue<{ searchId: string; reason: string }, void, "dead-search">(SEARCH_DLQ_NAME, {
      connection: redisConnection
    })
  : null;

export async function enqueueSearchJob(searchId: string): Promise<void> {
  if (!searchQueue) {
    void processSearch(searchId);
    return;
  }
  await searchQueue.add(
    "process-search",
    { searchId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    }
  );
}

export async function enqueueDeadSearch(searchId: string, reason: string): Promise<void> {
  if (!searchDlq) return;
  await searchDlq.add("dead-search", { searchId, reason }, { removeOnComplete: 1000, removeOnFail: 1000 });
}
