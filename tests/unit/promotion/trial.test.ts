/**
 * Promotion Gate P1a — Task 4: runTrial 통합 테스트.
 *
 * 동일 fixture 로 baseline(현 카탈로그) vs candidate(현 + 후보 rule) 두 번 시험 후 판정.
 * - 빈 후보 → baseline==candidate → 동률 → NEEDS_HUMAN_REVIEW
 * - 모든 변경에 high 를 뱉는 "헛경보 유발" 후보 → fp 악화 → REJECTED
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runTrial } from "../../../src/core/promotion/trial.js";
import type { DeterministicRule } from "../../../src/rules/types.js";
import { DEFAULT_BENCHMARK_RULES } from "../../../src/benchmark/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

// 모든 변경에 high finding 을 뱉는 "헛경보 유발" 후보 rule.
const noisyRule: DeterministicRule = {
  id: "noisy-test-rule",
  describe: "test-only: always fires high",
  run: async () => [{ ruleId: "noisy-test-rule", severity: "high", message: "noise" }]
};

test("후보 없음(빈 배열) → 동률 → NEEDS_HUMAN_REVIEW", async () => {
  const t = await runTrial(fixturesRoot, []);
  assert.equal(t.decision.verdict, "NEEDS_HUMAN_REVIEW");
});

test("헛경보 유발 후보 → fp 악화 → REJECTED", async () => {
  const t = await runTrial(fixturesRoot, [noisyRule]);
  assert.equal(t.decision.verdict, "REJECTED");
  assert.ok(t.candidate.falsePositiveRate >= t.baseline.falsePositiveRate);
});

test("activeBaseline 주입 시 baseline 룰셋으로 사용(채용분 반영)", async () => {
  // noisyRule 을 baseline 에 이미 포함시키면 candidate(=baseline+noisy)와 동률 → NEEDS_HUMAN_REVIEW
  const active = [...DEFAULT_BENCHMARK_RULES, noisyRule];
  const t = await runTrial(fixturesRoot, [noisyRule], { activeBaseline: active });
  // 가짜 통과 방지: 미수정 시그니처는 3번째 인자(opts)를 filterGroup(string)으로 오인 →
  // group 매칭 실패로 0 시나리오(emptyReport)가 되어 우연히 동률 NEEDS_HUMAN_REVIEW 가 나온다.
  // activeBaseline 이 실제 baseline 룰셋으로 쓰여야 시나리오가 실행된다.
  assert.ok(t.baseline.totalScenarios > 0, "baseline 은 실제 시나리오로 실행돼야 함(opts 오인 시 0)");
  assert.equal(t.decision.verdict, "NEEDS_HUMAN_REVIEW");
});
