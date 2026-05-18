import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCodexRealAdapter,
  type SpawnLike
} from "../../../src/integrations/codex/real.js";

function fakeSpawn(
  responder: (cmd: string, args: readonly string[]) => {
    status: number;
    stdout?: string;
    stderr?: string;
  }
): SpawnLike {
  return (cmd, args) => {
    const r = responder(cmd, args);
    return {
      status: r.status,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? ""
    };
  };
}

test("codex real: available() true when probe exits 0", async () => {
  const a = createCodexRealAdapter({
    spawn: fakeSpawn(() => ({ status: 0, stdout: "codex 1.2.3\n" }))
  });
  assert.equal(await a.available(), true);
});

test("codex real: available() false when probe fails", async () => {
  const a = createCodexRealAdapter({
    spawn: fakeSpawn(() => ({ status: 127, stderr: "not found" }))
  });
  assert.equal(await a.available(), false);
});

test("codex real: parses JSON output to ReviewResult", async () => {
  const a = createCodexRealAdapter({
    spawn: fakeSpawn(() => ({
      status: 0,
      stdout: JSON.stringify({
        status: "warnings",
        findings: [{ severity: "high", title: "x" }],
        summary: "1 hi"
      })
    }))
  });
  const r = await a.run({ rawDiff: "diff" });
  assert.equal(r.status, "warnings");
  assert.equal(r.findings.length, 1);
  assert.equal(r.adapterId, "codex");
});

test("codex real: non-JSON output captured as warning", async () => {
  const a = createCodexRealAdapter({
    spawn: fakeSpawn(() => ({ status: 0, stdout: "looks ok to me" }))
  });
  const r = await a.run({ rawDiff: "diff" });
  assert.equal(r.status, "warnings");
  assert.equal(r.findings.length, 1);
});

test("codex real: non-zero exit yields failed status with high finding", async () => {
  const a = createCodexRealAdapter({
    spawn: fakeSpawn(() => ({ status: 1, stderr: "boom" }))
  });
  const r = await a.run({ rawDiff: "diff" });
  assert.equal(r.status, "failed");
  assert.equal(r.findings[0]?.severity, "high");
});

test("codex real: passes input rawDiff through stdin", async () => {
  let capturedInput: string | undefined;
  const a = createCodexRealAdapter({
    spawn: (cmd, args, options) => {
      if (args[0] === "--version")
        return { status: 0, stdout: "v", stderr: "" };
      capturedInput = options.input;
      return {
        status: 0,
        stdout: JSON.stringify({ status: "passed", findings: [] }),
        stderr: ""
      };
    }
  });
  await a.run({ rawDiff: "the diff" });
  assert.equal(capturedInput, "the diff");
});
