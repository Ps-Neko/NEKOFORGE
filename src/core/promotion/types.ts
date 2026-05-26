/**
 * Promotion Gate 판정 타입 (PROMOTION-GATE.md §4).
 *
 * 카탈로그 채용 결정의 verdict 어휘. decision.schema 의 게이트 verdict 와
 * 같은 enum 패턴을 "카탈로그에 들일지" 판단용으로 재사용한다(값은 별개).
 */
export type PromoteVerdict =
  | "PROMOTE_READY"
  | "REJECTED"
  | "INSUFFICIENT_EVIDENCE"
  | "NEEDS_HUMAN_REVIEW";

export interface PromotionDecision {
  verdict: PromoteVerdict;
  reasons: string[];
}
