import "dotenv/config";
import { Worker } from "bullmq";
import { ensureMarketplaceConfigs } from "./marketplace-config";
import { prisma } from "./prisma";
import { enqueueDeadSearch, SEARCH_QUEUE_NAME } from "./queues";
import { processSearch } from "./services/search-pipeline";
import { incrementMetric, setWorkerHeartbeat } from "./services/metrics";

async function main() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required for worker mode");
  }

  await ensureMarketplaceConfigs();

  const connection = { url: process.env.REDIS_URL };
  const worker = new Worker<{ searchId: string }>(
    SEARCH_QUEUE_NAME,
    async (job) => {
      await processSearch(job.data.searchId);
    },
    { connection, concurrency: 6 }
  );

  const heartbeat = setInterval(() => {
    void setWorkerHeartbeat("search-worker");
  }, 15000);

  worker.on("completed", async (job) => {
    await incrementMetric("worker_jobs_completed_total");
    console.log(`search job completed: ${job.id}`);
  });

  worker.on("failed", async (job, error) => {
    await incrementMetric("worker_jobs_failed_total");
    const searchId = job?.data.searchId;
    if (searchId) {
      await enqueueDeadSearch(searchId, error.message);
    }
    console.error(`search job failed: ${job?.id}`, error);
  });

  const shutdown = async () => {
    clearInterval(heartbeat);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
