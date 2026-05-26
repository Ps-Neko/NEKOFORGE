/**
 * Promotion Gate P1a — Task 3: comparePromotion 엄격 합격 판정 경계 테스트.
 *
 * PROMOTION-GATE.md §5: recall(after) ≥ recall(before) AND fpRate(after) ≤ fpRate(before)
 * AND 최소 하나는 strict 개선 → PROMOTE_READY. 동률 → NEEDS_HUMAN_REVIEW. 악화 → REJECTED.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePromotion } from "../../../src/core/promotion/decide.js";
import type { BenchmarkReport } from "../../../src/benchmark/index.js";

function rep(recall: number, fp: number): BenchmarkReport {
  return {
    totalScenarios: 0, passed: 0, failed: 0, byGroup: {},
    criticalRecall: recall, falsePositiveRate: fp, results: []
  };
}

test("recall↑ + fp 동일 → PROMOTE_READY", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.9, 0.1)).verdict, "PROMOTE_READY");
});
test("recall 동일 + fp↓ → PROMOTE_READY", () => {
  assert.equal(comparePromotion(rep(0.8, 0.2), rep(0.8, 0.1)).verdict, "PROMOTE_READY");
});
test("fp 악화 → REJECTED", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.9, 0.2)).verdict, "REJECTED");
});
test("recall 하락 → REJECTED", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.7, 0.05)).verdict, "REJECTED");
});
test("완전 동률 → NEEDS_HUMAN_REVIEW (개선 없음)", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.8, 0.1)).verdict, "NEEDS_HUMAN_REVIEW");
});
