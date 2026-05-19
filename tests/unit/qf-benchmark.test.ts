/**
 * Phase QF — benchmark runner 회귀 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runBenchmark } from "../../src/benchmark/index.js";

const __filename = fileURLToPath(import.meta.url);
const fixturesRoot = resolve(__filename, "../../../fixtures");

test("benchmark: scans fixtures and produces report", async () => {
  const r = await runBenchmark(fixturesRoot);
  assert.ok(r.totalScenarios > 0, "no scenarios scanned");
  assert.ok(r.byGroup.security, "security group missing");
});

test("benchmark: filter by group", async () => {
  const r = await runBenchmark(fixturesRoot, "security");
  for (const s of r.results) {
    assert.equal(s.group, "security");
  }
});
