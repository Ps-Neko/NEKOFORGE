/**
 * quality-score calculator (Phase QF).
 *
 * gate 의 finding/review/tests 입력을 8개 영역 점수로 환원한다.
 * LLM 호출 없이 결정적으로 계산. ux/performance 는 약점 인정 — finding 카운트 기반의 단순 점수.
 */
import type { RuleFinding } from "../../rules/types.js";

export interface QualityScoreInput {
  findings: readonly RuleFinding[];
  architectureFindings?: readonly RuleFinding[];
  designFindings?: readonly RuleFinding[];
  testStatus: "passed" | "failed" | "not_run" | "insufficient";
  reviewStatus: "passed" | "warnings" | "failed" | "not_run";
  evidenceComplete: boolean;
  qualityBars: Record<string, { minimum: number; required: boolean }>;
  taskId: string;
  uiTouched?: boolean;
}

export interface QualityScoreResult {
  schemaVersion: "0.4";
  taskId: string;
  scores: {
    correctness: number;
    testCoverage: number;
    security: number;
    maintainability: number;
    architecture: number;
    ux: number;
    performance: number;
    evidence: number;
    overall: number;
  };
  weights: Record<string, number>;
  thresholds: {
    pass: number;
    passWithWarnings: number;
    needsHumanReview: number;
    blockBelow: number;
  };
  reasons: string[];
  failedQualityBars: string[];
}

const DEFAULT_WEIGHTS = {
  correctness: 0.2,
  testCoverage: 0.15,
  security: 0.2,
  maintainability: 0.15,
  architecture: 0.15,
  ux: 0.05,
  performance: 0.05,
  evidence: 0.05
};

const DEFAULT_THRESHOLDS = {
  pass: 85,
  passWithWarnings: 75,
  needsHumanReview: 60,
  blockBelow: 60
};

function countBy(
  findings: readonly RuleFinding[],
  severity: RuleFinding["severity"]
): number {
  return findings.filter((f) => f.severity === severity).length;
}

function deductForFindings(
  findings: readonly RuleFinding[],
  perCritical: number,
  perHigh: number,
  perWarning: number
): number {
  const c = countBy(findings, "critical");
  const h = countBy(findings, "high");
  const w = countBy(findings, "warning");
  return Math.min(100, c * perCritical + h * perHigh + w * perWarning);
}

export function calculateQualityScore(
  input: QualityScoreInput
): QualityScoreResult {
  const reasons: string[] = [];

  // 1. correctness — 테스트 통과 + finding 영향.
  let correctness = 100;
  if (input.testStatus === "failed") {
    correctness -= 60;
    reasons.push("tests failed");
  } else if (input.testStatus === "not_run") {
    correctness -= 30;
    reasons.push("tests not run");
  } else if (input.testStatus === "insufficient") {
    correctness -= 20;
  }
  correctness = Math.max(0, correctness - deductForFindings(input.findings, 0, 5, 1));

  // 2. testCoverage — 본 도구는 c8 미통합. 보수적으로 testStatus 기반.
  let testCoverage = 100;
  if (input.testStatus === "failed") testCoverage = 30;
  else if (input.testStatus === "not_run") testCoverage = 40;
  else if (input.testStatus === "insufficient") testCoverage = 60;
  // no-test-risk finding 발화 시 추가 감점
  const noTestRisk = input.findings.filter((f) => f.ruleId === "no-test-risk");
  testCoverage = Math.max(0, testCoverage - noTestRisk.length * 15);

  // 3. security — deterministic rule 보안 카테고리 발화 기반.
  const securityRules = new Set([
    "secret-fallback",
    "auth-bypass",
    "dangerous-file-write",
    "hook-injection-risk",
    "agent-permission-risk"
  ]);
  const secFindings = input.findings.filter((f) => securityRules.has(f.ruleId));
  let security = 100;
  security -= deductForFindings(secFindings, 50, 20, 5);
  security = Math.max(0, security);

  // 4. maintainability — architecture finding 의 maintainability 항목 + 일반 warning.
  const archAll = input.architectureFindings ?? [];
  let maintainability = 100;
  maintainability -= deductForFindings(archAll, 30, 15, 3);
  maintainability = Math.max(0, maintainability);

  // 5. architecture — circular dep, layer violation 중심.
  const archCritical = countBy(archAll, "critical");
  const archHigh = countBy(archAll, "high");
  let architecture = 100;
  architecture -= archCritical * 40 + archHigh * 15;
  architecture = Math.max(0, architecture);

  // 6. ux — design finding 기반 (약점 영역).
  const desAll = input.designFindings ?? [];
  let ux: number;
  if (input.uiTouched) {
    ux = 100;
    ux -= deductForFindings(desAll, 30, 15, 3);
    ux = Math.max(0, ux);
    if (desAll.length === 0 && input.reviewStatus === "not_run") {
      ux = Math.max(0, ux - 20);
      reasons.push("UI touched but design review not_run");
    }
  } else {
    ux = 100; // UI 미터치면 만점 처리
  }

  // 7. performance — 측정 어려움. 기본 만점. test failed 시 약간 감점.
  let performance = 100;
  if (input.testStatus === "failed") performance = 70;

  // 8. evidence — 완전성.
  const evidence = input.evidenceComplete ? 100 : 40;
  if (!input.evidenceComplete) reasons.push("evidence incomplete");

  const scores = {
    correctness,
    testCoverage,
    security,
    maintainability,
    architecture,
    ux,
    performance,
    evidence,
    overall: 0
  };

  const weights = { ...DEFAULT_WEIGHTS };
  scores.overall = Math.round(
    Object.entries(weights).reduce(
      (sum, [k, w]) => sum + (scores as unknown as Record<string, number>)[k]! * w,
      0
    )
  );

  // qualityBars 위반 검사.
  const failedQualityBars: string[] = [];
  for (const [bar, spec] of Object.entries(input.qualityBars)) {
    const s = (scores as unknown as Record<string, number>)[bar];
    if (s === undefined) continue;
    if (s < spec.minimum) {
      failedQualityBars.push(`${bar}:${s}<${spec.minimum}`);
      if (spec.required) {
        reasons.push(`required quality bar failed: ${bar} (${s} < ${spec.minimum})`);
      }
    }
  }

  return {
    schemaVersion: "0.4",
    taskId: input.taskId,
    scores,
    weights,
    thresholds: { ...DEFAULT_THRESHOLDS },
    reasons,
    failedQualityBars
  };
}

export interface ScoreVerdictHint {
  capAt:
    | "PASS"
    | "PASS_WITH_WARNINGS"
    | "NEEDS_HUMAN_REVIEW"
    | "BLOCK"
    | "INSUFFICIENT_EVIDENCE";
  reason: string;
}

/**
 * verdict 결정 시 score 가 verdict 상한을 어떻게 잡는지 힌트 반환.
 */
export function verdictHintFromScore(
  result: QualityScoreResult,
  hasRequiredFailure: boolean
): ScoreVerdictHint {
  const overall = result.scores.overall;
  if (hasRequiredFailure) {
    return {
      capAt: "NEEDS_HUMAN_REVIEW",
      reason: `required quality bar failed (${result.failedQualityBars.join(", ")})`
    };
  }
  if (overall < result.thresholds.blockBelow) {
    return {
      capAt: "NEEDS_HUMAN_REVIEW",
      reason: `overall score ${overall} < blockBelow ${result.thresholds.blockBelow}`
    };
  }
  if (overall < result.thresholds.needsHumanReview) {
    return {
      capAt: "NEEDS_HUMAN_REVIEW",
      reason: `overall score ${overall} < needsHumanReview ${result.thresholds.needsHumanReview}`
    };
  }
  if (overall < result.thresholds.passWithWarnings) {
    return {
      capAt: "PASS_WITH_WARNINGS",
      reason: `overall score ${overall} < passWithWarnings ${result.thresholds.passWithWarnings}`
    };
  }
  if (overall < result.thresholds.pass) {
    return {
      capAt: "PASS_WITH_WARNINGS",
      reason: `overall score ${overall} < pass ${result.thresholds.pass}`
    };
  }
  return { capAt: "PASS", reason: `overall score ${overall} meets all thresholds` };
}
