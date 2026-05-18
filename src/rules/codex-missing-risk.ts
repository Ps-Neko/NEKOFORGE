/**
 * SECURITY.md §3.9 — 고위험 변경 + Codex review 부재 (v3 신규).
 *
 * 입력:
 * - ctx.highRiskFlags: 다른 rule 들이 고위험을 발화했는지 정리한 플래그.
 * - ctx.review: review adapter 상태 + adapter 수.
 *
 * 출력:
 * - adapter 0개 + 고위험 → critical (verdict 매핑 시 INSUFFICIENT_EVIDENCE).
 * - adapter ≥1 + status=not_run + 고위험 → high (NEEDS_HUMAN_REVIEW).
 */
import type { DeterministicRule } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "codex-missing-risk";

function isHighRisk(flags: Required<NonNullable<unknown>> | undefined): boolean {
  if (!flags) return false;
  const f = flags as Record<string, boolean | undefined>;
  return Boolean(
    f.dangerousFileWrite ||
      f.authBypass ||
      f.secretFallback ||
      f.hookInjection ||
      f.agentPermissionExpansion ||
      f.testDeletion
  );
}

export const codexMissingRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "고위험 변경인데 외부 ReviewAdapter 결과가 부재",
  async run(ctx) {
    if (!isHighRisk(ctx.highRiskFlags)) return [];

    const review = ctx.review;
    if (!review || review.adapterCount === 0) {
      return [
        makeFinding(
          RULE_ID,
          "critical",
          "high-risk change detected but no review adapter is configured"
        )
      ];
    }
    if (review.status === "not_run") {
      return [
        makeFinding(
          RULE_ID,
          "high",
          `high-risk change detected and ${review.adapterCount} adapter(s) returned not_run`
        )
      ];
    }
    return [];
  }
};
