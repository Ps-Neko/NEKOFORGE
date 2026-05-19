/**
 * Codex re-review #1 (Major) — hooks 의 외부 명령 실제 실행 회귀 테스트.
 *
 * SPAWN_INJECTOR 를 fake spawn 으로 교체해 spawnSync 호출 없이 실행 의미를 확인한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultExecutor,
  SPAWN_INJECTOR,
  type SpawnLike
} from "../../../src/hooks/runner.js";
import type { Hook } from "../../../src/hooks/types.js";

function installFakeSpawn(fake: SpawnLike): () => void {
  const original = SPAWN_INJECTOR.spawn;
  SPAWN_INJECTOR.spawn = fake;
  return () => {
    SPAWN_INJECTOR.spawn = original;
  };
}

const ctx = { stage: "work", cwd: "." };

test("defaultExecutor: external command success → status ok", async () => {
  const restore = installFakeSpawn(() => ({
    status: 0,
    stdout: "ok",
    stderr: ""
  }));
  try {
    const hook: Hook = {
      id: "tc",
      type: "pre-tool",
      command: "tsc --noEmit",
      blocking: true
    };
    const r = await defaultExecutor(hook, ctx);
    assert.equal(r.status, "ok");
    assert.equal(r.exitCode, 0);
  } finally {
    restore();
  }
});

test("defaultExecutor: external command non-zero exit → status failed", async () => {
  const restore = installFakeSpawn(() => ({
    status: 1,
    stdout: "",
    stderr: "type errors found"
  }));
  try {
    const hook: Hook = {
      id: "tc",
      type: "pre-tool",
      command: "tsc --noEmit",
      blocking: true
    };
    const r = await defaultExecutor(hook, ctx);
    assert.equal(r.status, "failed");
    assert.equal(r.exitCode, 1);
    assert.match(r.reason ?? "", /exit=1/);
  } finally {
    restore();
  }
});

test("defaultExecutor: stderr secrets are masked in output", async () => {
  const restore = installFakeSpawn(() => ({
    status: 1,
    stdout: "",
    stderr: "auth failed key=sk_test_abcdefghijklmnopqrstuvwxyz0123456789"
  }));
  try {
    const hook: Hook = {
      id: "auth-probe",
      type: "pre-apply",
      command: "git status",
      blocking: false
    };
    const r = await defaultExecutor(hook, ctx);
    assert.ok(
      !(r.output ?? "").includes(
        "sk_test_abcdefghijklmnopqrstuvwxyz0123456789"
      ),
      "unmasked secret leaked into hook output"
    );
    assert.match(r.output ?? "", /sk_t\*+/);
  } finally {
    restore();
  }
});

test("defaultExecutor: internal:noop short-circuits without spawn", async () => {
  let spawnCalled = false;
  const restore = installFakeSpawn(() => {
    spawnCalled = true;
    return { status: 0, stdout: "", stderr: "" };
  });
  try {
    const hook: Hook = {
      id: "noop",
      type: "pre-tool",
      command: "internal:noop"
    };
    const r = await defaultExecutor(hook, ctx);
    assert.equal(r.status, "ok");
    assert.equal(spawnCalled, false);
  } finally {
    restore();
  }
});

test("defaultExecutor: unknown internal → skipped", async () => {
  const hook: Hook = {
    id: "u",
    type: "pre-tool",
    command: "internal:wat"
  };
  const r = await defaultExecutor(hook, ctx);
  assert.equal(r.status, "skipped");
});
