/**
 * Worker adapter interface 단위 — Phase WF-3 prototype.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShellWorkerAdapterStub,
  resolveWorkerAdapter
} from "../../../src/workers/adapter.js";
// claude 어댑터를 registry 에 등록하기 위해 import (side-effect).
import "../../../src/workers/adapters/claude.js";

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

test("resolveWorkerAdapter: shell + claude known, unknown null", () => {
  assert.ok(resolveWorkerAdapter("shell"));
  assert.ok(resolveWorkerAdapter("shell-stub"));
  assert.ok(resolveWorkerAdapter("claude")); // WF-3: claude 워커 어댑터 등록됨
  assert.equal(resolveWorkerAdapter("codex"), null); // codex 는 review 어댑터(worker 아님)
  assert.equal(resolveWorkerAdapter("gemini"), null);
});
