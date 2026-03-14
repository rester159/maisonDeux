import test from "node:test";
import assert from "node:assert/strict";
import { getMetricsSnapshot, getWorkerHeartbeat, incrementMetric, setGauge, setWorkerHeartbeat } from "./metrics";

test("metrics snapshot records counters and gauges", async () => {
  await incrementMetric("test_counter", 2);
  await setGauge("test_gauge", 42);
  const snapshot = await getMetricsSnapshot();
  assert.equal(snapshot.test_counter >= 2, true);
  assert.equal(snapshot.test_gauge, 42);
});

test("worker heartbeat writes readable payload", async () => {
  await setWorkerHeartbeat("test-worker");
  const heartbeat = await getWorkerHeartbeat();
  assert.equal(Boolean(heartbeat), true);
  assert.equal(heartbeat?.worker === "test-worker" || heartbeat?.worker === "local", true);
});
