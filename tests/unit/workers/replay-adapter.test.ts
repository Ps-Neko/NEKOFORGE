import { test } from "node:test";
import assert from "node:assert/strict";
import { createReplayWorkerAdapter } from "../../../src/workers/adapters/replay.js";

test("replay adapter: spawn 없이 completed + 캡처 resultMd 반환", async () => {
  const a = createReplayWorkerAdapter({ resultMd: "# captured worker output" });
  assert.equal(a.id, "replay");
  assert.equal(a.estimateCostUsd, 0);
  assert.equal(await a.available(), true);
  const r = await a.dispatch({ role: "implementation-worker", prompt: "ignored", taskId: "TASK-001" });
  assert.equal(r.status, "completed");
  assert.equal(r.resultMd, "# captured worker output");
  assert.equal(r.notes, "replay (no spawn)");
});

test("replay adapter: resultMd 기본값 제공", async () => {
  const a = createReplayWorkerAdapter();
  const r = await a.dispatch({ role: "implementation-worker", prompt: "x", taskId: "T" });
  assert.equal(r.status, "completed");
  assert.ok(r.resultMd.length > 0);
});
