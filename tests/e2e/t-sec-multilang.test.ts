/**
 * Phase E — Python/Go T-SEC e2e.
 *
 * SECURITY.md §3 룰들이 Python/Go 변경에 대해서도 동일하게 verdict 를 만든다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { seedHarness, diffLines, writeLastDiff } from "./_seed.js";
import { runGate } from "../../src/core/gate/index.js";
import { runApply } from "../../src/core/apply/index.js";
import { AutoApplyBlockedError } from "../../src/rules/auto-apply-block.js";

const GATE_OPTS = {
  taskId: "TASK-001" as const,
  testStatus: "passed" as const
};

async function readDecision(cwd: string): Promise<{ verdict: string; triggered: string[] }> {
  const text = await readFile(
    join(cwd, ".harness", "decision.json"),
    "utf8"
  );
  const d = JSON.parse(text) as {
    verdict: string;
    deterministicRules?: { triggeredRules: string[] };
  };
  return {
    verdict: d.verdict,
    triggered: d.deterministicRules?.triggeredRules ?? []
  };
}

test("T-SEC-PY-01: python secret-fallback → BLOCK → apply exit 4", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/app/conf.py b/app/conf.py",
      "@@ -1 +1 @@",
      "-key = None",
      '+key = os.getenv("API_KEY", "fallback-12345abc")'
    )
  );
  await runGate(GATE_OPTS, ws.deps);
  const d = await readDecision(ws.cwd);
  assert.equal(d.verdict, "BLOCK");
  assert.ok(d.triggered.includes("secret-fallback"));
  try {
    await runApply({ approved: true }, ws.deps);
    assert.fail();
  } catch (err) {
    assert.ok(err instanceof AutoApplyBlockedError);
  }
});

test("T-SEC-PY-02: python test file deletion → BLOCK", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/tests/test_user.py b/tests/test_user.py",
      "deleted file mode 100644",
      "--- a/tests/test_user.py",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-def test_user(): pass"
    )
  );
  await runGate(GATE_OPTS, ws.deps);
  const d = await readDecision(ws.cwd);
  assert.equal(d.verdict, "BLOCK");
  assert.ok(d.triggered.includes("test-deletion"));
});

test("T-SEC-GO-01: go secret-fallback (GetEnvOrDefault) → BLOCK", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/cmd/main.go b/cmd/main.go",
      "@@ -1 +1 @@",
      '-key := ""',
      '+key := GetEnvOrDefault("API_KEY", "fallback-abcdef")'
    )
  );
  await runGate(GATE_OPTS, ws.deps);
  const d = await readDecision(ws.cwd);
  assert.equal(d.verdict, "BLOCK");
  assert.ok(d.triggered.includes("secret-fallback"));
});

test("T-SEC-GO-02: go _test.go deletion → BLOCK", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/pkg/foo_test.go b/pkg/foo_test.go",
      "deleted file mode 100644",
      "--- a/pkg/foo_test.go",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-func TestFoo(t *testing.T) {}"
    )
  );
  await runGate(GATE_OPTS, ws.deps);
  const d = await readDecision(ws.cwd);
  assert.equal(d.verdict, "BLOCK");
  assert.ok(d.triggered.includes("test-deletion"));
});

test("T-SEC-GO-03: go auth bypass (RequireAuth removed) → BLOCK", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/internal/server/router.go b/internal/server/router.go",
      "@@ -1,2 +1,1 @@",
      "-r.Use(RequireAuth())",
      " r.GET(\"/health\", handler)"
    )
  );
  await runGate(GATE_OPTS, ws.deps);
  const d = await readDecision(ws.cwd);
  assert.equal(d.verdict, "BLOCK");
  assert.ok(d.triggered.includes("auth-bypass"));
});
