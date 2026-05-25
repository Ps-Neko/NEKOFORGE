import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeWorkerAdapter } from "../../../src/workers/adapters/claude.js";
import type { SpawnLike } from "../../../src/workers/adapters/claude.js";

const okSpawn: SpawnLike = (_cmd, args) => {
  if (args.includes("--version")) return { status: 0, stdout: "claude 2.1.150", stderr: "" };
  return { status: 0, stdout: "구현 완료: src/foo.ts 에 함수 추가", stderr: "" };
};

test("claude adapter: available() 는 --version probe 성공 시 true", async () => {
  const a = createClaudeWorkerAdapter({ spawn: okSpawn });
  assert.equal(await a.available(), true);
});

test("claude adapter: dispatch 는 prompt 를 stdin 으로 넘기고 completed 반환", async () => {
  let sentInput = "";
  const spy: SpawnLike = (_cmd, _args, opts) => {
    sentInput = opts?.input ?? "";
    return { status: 0, stdout: "done", stderr: "" };
  };
  const a = createClaudeWorkerAdapter({ spawn: spy });
  const r = await a.dispatch({ role: "implementation-worker", prompt: "PROMPT-XYZ", taskId: "TASK-001" });
  assert.equal(r.status, "completed");
  assert.match(sentInput, /PROMPT-XYZ/);
});

test("claude adapter: non-zero exit 이면 failed", async () => {
  const badSpawn: SpawnLike = () => ({ status: 1, stdout: "", stderr: "boom" });
  const a = createClaudeWorkerAdapter({ spawn: badSpawn });
  const r = await a.dispatch({ role: "implementation-worker", prompt: "x", taskId: "T" });
  assert.equal(r.status, "failed");
});
