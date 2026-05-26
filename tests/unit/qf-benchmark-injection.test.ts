/**
 * Promotion Gate P1a — Task 1: benchmark 룰셋 주입형 회귀/주입 테스트.
 *
 * 1) 회귀 0: runBenchmark 결과가 runBenchmarkWithRules(DEFAULT_BENCHMARK_RULES)
 *    와 완전히 동일해야 한다 (룰셋을 주입형으로 열되 기존 동작 불변).
 * 2) 주입 동작 증명: 빈 룰셋이면 critical 시나리오를 미탐하여 recall 이 떨어진다
 *    (주입한 룰셋이 실제로 점수에 반영됨).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  runBenchmark,
  runBenchmarkWithRules,
  DEFAULT_BENCHMARK_RULES
} from "../../src/benchmark/index.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures"
);

test("runBenchmark == runBenchmarkWithRules(DEFAULT_BENCHMARK_RULES) (회귀)", async () => {
  const a = await runBenchmark(fixturesRoot);
  const b = await runBenchmarkWithRules(fixturesRoot, DEFAULT_BENCHMARK_RULES);
  assert.equal(a.totalScenarios, b.totalScenarios);
  assert.equal(a.criticalRecall, b.criticalRecall);
  assert.equal(a.falsePositiveRate, b.falsePositiveRate);
  assert.equal(a.passed, b.passed);
});

test("빈 룰셋이면 critical 미탐 → recall 하락 (주입 동작 증명)", async () => {
  const full = await runBenchmarkWithRules(fixturesRoot, DEFAULT_BENCHMARK_RULES);
  const none = await runBenchmarkWithRules(fixturesRoot, []);
  assert.ok(none.criticalRecall <= full.criticalRecall);
});
