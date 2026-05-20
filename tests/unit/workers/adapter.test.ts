/**
 * Worker adapter interface 단위 — Phase WF-3 prototype.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShellWorkerAdapterStub,
  resolveWorkerAdapter
} from "../../../src/workers/adapter.js";

test("shell stub: available true + dispatch returns skipped (no auto-spawn)", async () => {
  const a = createShellWorkerAdapterStub();
  assert.equal(await a.available(), true);
  const r = await a.dispatch({
    role: "implementation-worker",
    prompt: "anything",
    taskId: "TASK-001"
  });
  assert.equal(r.status, "skipped");
  assert.match(r.resultMd, /stub/);
});

test("resolveWorkerAdapter: shell + unknown", () => {
  assert.ok(resolveWorkerAdapter("shell"));
  assert.ok(resolveWorkerAdapter("shell-stub"));
  assert.equal(resolveWorkerAdapter("codex"), null);
  assert.equal(resolveWorkerAdapter("claude"), null);
});
