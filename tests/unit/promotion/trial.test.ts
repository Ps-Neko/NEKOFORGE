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
