/**
 * verdict 산출 알고리즘 — WORKFLOW.md §3.12.
 *
 * 입력 : finding 배열 + 테스트 상태 + review 상태.
 * 출력 : verdict + riskLevel + humanApprovalRequired + 사유 목록.
 */
import type { RuleFinding } from "../../rules/types.js";

export type Verdict =
  | "PASS"
  | "PASS_WITH_WARNINGS"
  | "NEEDS_HUMAN_REVIEW"
  | "BLOCK"
  | "INSUFFICIENT_EVIDENCE";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface VerdictInputs {
  findings: readonly RuleFinding[];
  testStatus: "passed" | "failed" | "not_run" | "insufficient";
  reviewStatus: "passed" | "warnings" | "failed" | "not_run";
  evidenceMissing?: boolean;
  schemaFailed?: boolean;
}

export interface VerdictOutput {
  verdict: Verdict;
  riskLevel: RiskLevel;
  humanApprovalRequired: boolean;
  reasons: string[];
}

export function computeVerdict(input: VerdictInputs): VerdictOutput {
  const reasons: string[] = [];

  if (input.evidenceMissing || input.schemaFailed) {
    reasons.push(input.evidenceMissing ? "required evidence missing" : "schema validation failed");
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  const critical = input.findings.filter((f) => f.severity === "critical");
  const high = input.findings.filter((f) => f.severity === "high");
  const warning = input.findings.filter((f) => f.severity === "warning");

  if (critical.some((f) => f.ruleId === "codex-missing-risk")) {
    reasons.push(...critical.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (critical.length > 0) {
    reasons.push(...critical.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "BLOCK",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (input.testStatus === "failed") {
    reasons.push("tests failed");
    return {
      verdict: "NEEDS_HUMAN_REVIEW",
      riskLevel: "high",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (high.length > 0) {
    reasons.push(...high.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "NEEDS_HUMAN_REVIEW",
      riskLevel: "high",
      humanApprovalRequired: true,
      reasons
    };
  }

  // ⓐ 미검증=미통과: 독립 review 가 실행되지 않았거나(not_run) 실패했으면(failed)
  // 깨끗한 결과라도 PASS 로 묻지 않고 PASS_WITH_WARNINGS 로 가시화한다.
  // (--strict 게이트가 이 verdict 를 non-zero exit 으로 차단한다)
  const reviewIncomplete =
    input.reviewStatus === "not_run" || input.reviewStatus === "failed";

  if (warning.length > 0 || input.reviewStatus === "warnings" || reviewIncomplete) {
    reasons.push(...warning.map((f) => `[${f.ruleId}] ${f.message}`));
    if (input.reviewStatus === "warnings") {
      reasons.push("review adapter returned warnings");
    }
    if (reviewIncomplete) {
      reasons.push(
        input.reviewStatus === "failed"
          ? "no independent review (adapter failed)"
          : "no independent review run"
      );
    }
    return {
      verdict: "PASS_WITH_WARNINGS",
      riskLevel: "medium",
      humanApprovalRequired: false,
      reasons
    };
  }

  return {
    verdict: "PASS",
    riskLevel: "low",
    humanApprovalRequired: false,
    reasons: ["no triggered rules; tests passed; review ok"]
  };
}

/**
 * ⓑ `gate --strict` 의 verdict → process exit code 매핑.
 *
 * apply 와 통일한다: BLOCK/INSUFFICIENT_EVIDENCE=4, NEEDS_HUMAN_REVIEW=3.
 * strict 모드에서는 PASS_WITH_WARNINGS 도 사람이 검토해야 통과로 인정하므로 3 으로 차단한다.
 * 비-strict gate 는 이 함수를 호출하지 않고 항상 0 으로 종료한다(호환성 보존).
 */
export function gateStrictExitCode(verdict: Verdict): number {
  switch (verdict) {
    case "BLOCK":
    case "INSUFFICIENT_EVIDENCE":
      return 4;
    case "NEEDS_HUMAN_REVIEW":
    case "PASS_WITH_WARNINGS":
      return 3;
    case "PASS":
      return 0;
    default: {
      // 모든 Verdict 를 처리했는지 컴파일 타임에 강제
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}
