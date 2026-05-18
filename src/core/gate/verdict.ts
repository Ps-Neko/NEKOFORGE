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

  if (warning.length > 0 || input.reviewStatus === "warnings") {
    reasons.push(...warning.map((f) => `[${f.ruleId}] ${f.message}`));
    if (input.reviewStatus === "warnings") {
      reasons.push("review adapter returned warnings");
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
