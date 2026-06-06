/**
 * Fix #2 regression guard — taskId in dispatch must pass format validation
 * before being used in artifact file paths.
 *
 * Allowed: /^[A-Za-z0-9._-]{1,128}$/
 * Rejected: empty, NUL bytes, path separators, Windows reserved names
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDispatch, runDispatchAll, DispatchError } from "../../../src/workers/dispatch.js";
import type { StageDeps } from "../../../src/core/stage-runner.js";

/** Minimal stub deps that short-circuits artifact I/O. */
function makeDeps(): StageDeps {
  return {
    cwd: ".",
    clock: undefined,
    artifact: {
      exists: async () => false,
      readJson: async () => null,
      readMarkdown: async () => null,
      writeMarkdown: async () => {},
      writeJson: async () => {}
    }
  } as unknown as StageDeps;
}

// ---------- runDispatch ----------

test("dispatch: valid taskId passes format check", async () => {
  const deps = makeDeps();
  // Will fail at readWorkers (workers.json missing) but must NOT throw DispatchError
  await assert.rejects(
    () => runDispatch({ taskId: "TASK-001", worker: "implementation-worker" }, deps),
    (err: unknown) => {
      assert.ok(!(err instanceof DispatchError), `must not throw DispatchError, got: ${err}`);
      return true;
    }
  );
});

test("dispatch: empty taskId is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "empty taskId must throw DispatchError"
  );
});

test("dispatch: taskId with NUL byte is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "TASK\0evil", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "NUL byte in taskId must throw DispatchError"
  );
});

test("dispatch: taskId with forward slash is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "../../etc/passwd", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "path-traversal taskId must throw DispatchError"
  );
});

test("dispatch: taskId with backslash is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "TASK\\evil", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "backslash in taskId must throw DispatchError"
  );
});

test("dispatch: Windows reserved name NUL is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "NUL", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "Windows reserved name NUL must throw DispatchError"
  );
});

test("dispatch: Windows reserved name CON is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "CON", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "Windows reserved name CON must throw DispatchError"
  );
});

test("dispatch: Windows reserved name COM1 is rejected", async () => {
  await assert.rejects(
    () => runDispatch({ taskId: "COM1", worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "Windows reserved name COM1 must throw DispatchError"
  );
});

test("dispatch: taskId exceeding 128 chars is rejected", async () => {
  const long = "A".repeat(129);
  await assert.rejects(
    () => runDispatch({ taskId: long, worker: "implementation-worker" }, makeDeps()),
    DispatchError,
    "taskId >128 chars must throw DispatchError"
  );
});

// ---------- runDispatchAll ----------

test("dispatchAll: empty taskId is rejected", async () => {
  await assert.rejects(
    () => runDispatchAll({ taskId: "" }, makeDeps()),
    DispatchError,
    "empty taskId must throw DispatchError in runDispatchAll"
  );
});

test("dispatchAll: path-separator taskId is rejected", async () => {
  await assert.rejects(
    () => runDispatchAll({ taskId: "foo/bar" }, makeDeps()),
    DispatchError,
    "path-separator taskId must throw DispatchError in runDispatchAll"
  );
});
