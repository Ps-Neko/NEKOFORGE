import type { BenchmarkReport } from "../../benchmark/index.js";
import type { PromotionDecision } from "./types.js";

/**
 * 엄격 합격 판정 (PROMOTION-GATE.md §5).
 *   recall(after) ≥ recall(before) AND fpRate(after) ≤ fpRate(before)
 *   AND 최소 하나는 strict 개선 → PROMOTE_READY
 *   동률 → NEEDS_HUMAN_REVIEW, 악화 → REJECTED
 * 전체 룰셋 점수 기준(cross-rule interference 반영).
 */
export function comparePromotion(
  baseline: BenchmarkReport,
  candidate: BenchmarkReport
): PromotionDecision {
  const reasons = [
    `recall ${baseline.criticalRecall.toFixed(3)} -> ${candidate.criticalRecall.toFixed(3)}`,
    `fpRate ${baseline.falsePositiveRate.toFixed(3)} -> ${candidate.falsePositiveRate.toFixed(3)}`
  ];
  const recallOk = candidate.criticalRecall >= baseline.criticalRecall;
  const fpOk = candidate.falsePositiveRate <= baseline.falsePositiveRate;
  if (!recallOk || !fpOk) {
    return { verdict: "REJECTED", reasons: [...reasons, "지표 악화 — 둘 다 개선 조건 위반"] };
  }
  const recallStrict = candidate.criticalRecall > baseline.criticalRecall;
  const fpStrict = candidate.falsePositiveRate < baseline.falsePositiveRate;
  if (recallStrict || fpStrict) {
    return { verdict: "PROMOTE_READY", reasons };
  }
  return { verdict: "NEEDS_HUMAN_REVIEW", reasons: [...reasons, "개선 없음(동률) — 사람 판단 필요"] };
}
