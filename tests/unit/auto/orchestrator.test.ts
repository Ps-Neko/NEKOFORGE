import { test } from "node:test";
import assert from "node:assert/strict";
import { runAuto } from "../../../src/core/auto/index.js";
import type { WorkerAdapter } from "../../../src/workers/adapter.js";
import type { ReviewAdapter } from "../../../src/integrations/review-adapter.js";

const fakeWorker: WorkerAdapter & { estimateCostUsd?: number } = {
  id: "fake",
  estimateCostUsd: 0.1,
  async available() { return true; },
  async dispatch() {
    return { status: "completed" as const, resultMd: "fake impl" };
  }
};

const fakeReview: ReviewAdapter = {
  id: "fake-codex",
  async available() { return true; },
  async run() {
    return { adapterId: "fake-codex", status: "passed" as const, findings: [] };
  }
};

test("runAuto: 끝까지 진행해 verdict 를 내고 apply 는 절대 호출 안 함", async () => {
  let applyCalled = false;
  const r = await runAuto({
    goal: "테스트 목표",
    taskId: "TASK-001",
    maxCostUsd: 5,
    workerAdapter: fakeWorker,
    reviewAdapter: fakeReview,
    captureDiff: () => "diff --git a/src/x.ts b/src/x.ts\n+const x = 1;",
    onApply: () => { applyCalled = true; }
  });
  assert.ok(
    ["PASS", "PASS_WITH_WARNINGS", "NEEDS_HUMAN_REVIEW", "BLOCK", "INSUFFICIENT_EVIDENCE"].includes(r.verdict),
    `unexpected verdict: ${r.verdict}`
  );
  assert.equal(r.applied, false);
  assert.equal(applyCalled, false);
});

test("runAuto: --max-cost 0 이면 AI 호출 전 CostExceededError", async () => {
  await assert.rejects(
    () => runAuto({
      goal: "x",
      taskId: "TASK-001",
      maxCostUsd: 0,
      workerAdapter: fakeWorker,
      reviewAdapter: fakeReview,
      captureDiff: () => ""
    }),
    /상한|CostExceeded/
  );
});

test("runAuto: 사용자 goal 이 work 어댑터 프롬프트에 전달된다", async () => {
  let receivedPrompt = "";
  const spyWorker: WorkerAdapter & { estimateCostUsd?: number } = {
    id: "spy",
    estimateCostUsd: 0.1,
    async available() { return true; },
    async dispatch(input) {
      receivedPrompt = input.prompt;
      return { status: "completed" as const, resultMd: "ok" };
    }
  };
  await runAuto({
    goal: "사용자_고유_목표_XYZ",
    taskId: "TASK-001",
    maxCostUsd: 5,
    workerAdapter: spyWorker,
    reviewAdapter: fakeReview,
    captureDiff: () => "diff --git a/src/x.ts b/src/x.ts\n+const x = 1;"
  });
  assert.match(receivedPrompt, /사용자_고유_목표_XYZ/, "work 프롬프트에 사용자 goal 이 전달돼야 한다");
});

test("runAuto: work 어댑터가 failed 면 exitCode 6 으로 throw", async () => {
  const failWorker = {
    id: "fail", estimateCostUsd: 0.1,
    async available() { return true; },
    async dispatch() { return { status: "failed" as const, resultMd: "boom", notes: "test failure" }; }
  };
  const passReview = { id: "fake-codex", async available() { return true; },
    async run() { return { adapterId: "fake-codex", status: "passed" as const, findings: [] }; } };
  await assert.rejects(
    () => runAuto({
      goal: "x", taskId: "TASK-001", maxCostUsd: 5,
      workerAdapter: failWorker, reviewAdapter: passReview, captureDiff: () => ""
    }),
    (e: unknown) => { assert.equal((e as { exitCode?: number }).exitCode, 6); return true; }
  );
});
