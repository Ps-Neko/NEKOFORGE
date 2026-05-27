/**
 * Gate test-status regression tests.
 *
 * CLI should not inject "not_run" when --test-status is omitted. runGate must
 * use hook-derived test status consistently for decision, score, verdict, and
 * REPORT.md, while explicit input still wins.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runGate } from "../../src/core/gate/index.js";
import { overwriteJson, seedHarness } from "./_seed.js";

interface DecisionSnapshot {
  verdict: string;
  tests: { status: string };
}

interface QualityScoreSnapshot {
  scores: { testCoverage: number };
  reasons: string[];
}

async function readJson<T>(cwd: string, relPath: string): Promise<T> {
  const text = await readFile(join(cwd, ".harness", relPath), "utf8");
  return JSON.parse(text) as T;
}

async function readReport(cwd: string): Promise<string> {
  return readFile(join(cwd, "REPORT.md"), "utf8");
}

async function writeHookTestStatus(
  cwd: string,
  status: "ok" | "failed"
): Promise<void> {
  await overwriteJson(cwd, "hook-results.json", {
    results: [{ hookId: "post-tool/test", command: "npm test", status }]
  });
}

test("gate infers passed tests from hook results when testStatus is omitted", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);

  await writeHookTestStatus(ws.cwd, "ok");
  await runGate({ taskId: "TASK-001" }, ws.deps);

  const decision = await readJson<DecisionSnapshot>(ws.cwd, "decision.json");
  const quality = await readJson<QualityScoreSnapshot>(ws.cwd, "quality-score.json");
  const report = await readReport(ws.cwd);

  assert.equal(decision.tests.status, "passed");
  assert.equal(quality.scores.testCoverage, 100);
  assert.ok(!quality.reasons.includes("tests not run"));
  assert.match(report, /- tests: passed/);
});

test("gate uses failed hook status for verdict, quality score, and report when omitted", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);

  await writeHookTestStatus(ws.cwd, "failed");
  await runGate({ taskId: "TASK-001" }, ws.deps);

  const decision = await readJson<DecisionSnapshot>(ws.cwd, "decision.json");
  const quality = await readJson<QualityScoreSnapshot>(ws.cwd, "quality-score.json");
  const report = await readReport(ws.cwd);

  assert.equal(decision.tests.status, "failed");
  assert.equal(decision.verdict, "NEEDS_HUMAN_REVIEW");
  assert.equal(quality.scores.testCoverage, 30);
  assert.ok(quality.reasons.includes("tests failed"));
  assert.match(report, /- tests: failed/);
});

test("explicit testStatus overrides failed hook inference", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);

  await writeHookTestStatus(ws.cwd, "failed");
  await runGate({ taskId: "TASK-001", testStatus: "passed" }, ws.deps);

  const decision = await readJson<DecisionSnapshot>(ws.cwd, "decision.json");
  const quality = await readJson<QualityScoreSnapshot>(ws.cwd, "quality-score.json");
  const report = await readReport(ws.cwd);

  assert.equal(decision.tests.status, "passed");
  assert.equal(quality.scores.testCoverage, 100);
  assert.ok(!quality.reasons.includes("tests failed"));
  assert.match(report, /- tests: passed/);
});
