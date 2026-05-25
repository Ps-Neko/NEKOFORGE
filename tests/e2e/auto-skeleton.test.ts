import { test } from "node:test";
import assert from "node:assert/strict";
import { runAuto } from "../../src/core/auto/index.js";

const passReview = {
  id: "fake-codex",
  async available() {
    return true;
  },
  async run() {
    return {
      adapterId: "fake-codex",
      status: "passed" as const,
      findings: []
    };
  }
};

const fakeWorker = {
  id: "fake",
  estimateCostUsd: 0.1,
  async available() {
    return true;
  },
  async dispatch() {
    return { status: "completed" as const, resultMd: "impl" };
  }
};

test("e2e auto: 클린 diff → 게이트 도달 + verdict + apply 미수행", async () => {
  const r = await runAuto({
    goal: "작은 기능",
    taskId: "TASK-001",
    maxCostUsd: 5,
    workerAdapter: fakeWorker,
    reviewAdapter: passReview,
    captureDiff: () =>
      "diff --git a/src/x.ts b/src/x.ts\n--- a/src/x.ts\n+++ b/src/x.ts\n@@\n+export const x = 1;\n"
  });
  assert.equal(r.applied, false);
  assert.ok(r.verdict.length > 0);
});

test("e2e auto: secret 심은 diff → BLOCK (게이트가 막음, apply 불가)", async () => {
  const r = await runAuto({
    goal: "위험 변경",
    taskId: "TASK-001",
    maxCostUsd: 5,
    workerAdapter: fakeWorker,
    reviewAdapter: passReview,
    captureDiff: () =>
      'diff --git a/src/config.ts b/src/config.ts\n--- a/src/config.ts\n+++ b/src/config.ts\n@@ -1 +1 @@\n-const x = 1;\n+const KEY = process.env.API_KEY || "sk-test-fallback-12345";\n'
  });
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.applied, false);
});

test("e2e auto: max-cost 0 → AI 호출 전 중단", async () => {
  await assert.rejects(
    () =>
      runAuto({
        goal: "x",
        taskId: "TASK-001",
        maxCostUsd: 0,
        workerAdapter: fakeWorker,
        reviewAdapter: passReview,
        captureDiff: () => ""
      }),
    /상한|CostExceeded/
  );
});
