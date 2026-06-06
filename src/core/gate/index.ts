/**
 * gate 단계: deterministic rule + review + tests 종합 → verdict.
 * 출력: REPORT.md + .harness/decision.json (schema 검증 통과 필수).
 *
 * runGate 본문은 위상별 헬퍼(run-helpers.ts)로 분리되어 있다.
 * 공개 인터페이스(GateInput/GateResult/runGate 시그니처)는 변경 없음.
 */
import type { StageDeps } from "../stage-runner.js";

// 공개 API 호환 — 분리 모듈의 헬퍼를 gate/index 에서 재노출(기존 importer 보존).
export { resolveReviewStatus, inferTestStatusFromHooks } from "./evidence.js";
export { loadPromotedForCwd, collectActiveRuleIds } from "./rules-run.js";

import { type Verdict } from "./verdict.js";
import {
  checkEvidenceAndCells,
  readArtifactsAndBuildCtx,
  runRulesAndAudit,
  evaluateQualityContract,
  evaluateWorkerFactory,
  evaluatePacks,
  computeFinalVerdict,
  assembleDecision,
  writeGateOutputs,
  type GateInput
} from "./run-helpers.js";

// GateInput 은 run-helpers.ts 에서 정의 — 순환 방지를 위해 여기서 재노출.
export type { GateInput };

export interface GateResult {
  verdict: Verdict;
  reportPath: string;
  decisionPath: string;
  triggeredRules: string[];
}

export async function runGate(
  input: GateInput,
  deps: StageDeps
): Promise<GateResult> {
  // Phase 1: 필수 증거 수집 + factory cell 입력 확인.
  const { missing, evidenceMissing, cellInputs } =
    await checkEvidenceAndCells(deps);

  // Phase 2: artifact 읽기 + baseCtx 구성.
  const {
    rawDiff,
    diff,
    team,
    codexRaw,
    reviewStatus,
    reviewCritical,
    inferredTestStatus,
    effectiveTestStatus,
    baseCtx
  } = await readArtifactsAndBuildCtx(input, deps);

  // Phase 3: 규칙 실행 + audit chain 검증 + release benchmark.
  const { passTwo, archFindings, designFindings } =
    await runRulesAndAudit(input, baseCtx, deps);

  // Phase 4: quality-contract + quality-score 평가.
  const { contract, contractInvalid, qualityScore, scoreCap } =
    await evaluateQualityContract(
      passTwo,
      archFindings,
      designFindings,
      effectiveTestStatus,
      reviewStatus,
      evidenceMissing,
      diff,
      deps
    );

  // Phase 5: worker factory 평가.
  const {
    workers,
    workerResults: _workerResults,
    completedRoles,
    requiredRoles,
    missingWorkers,
    separationViolations,
    workerFindings,
    criticalWorkerFindings,
    highWorkerFindings: _highWorkerFindings,
    workerCap
  } = await evaluateWorkerFactory(input, passTwo, deps);

  // Phase 6: rule pack / skill pack 평가.
  const { rulePacks: _rulePacks, skillPacks, rulePackResolve, skillPackResolve, rulePackCap } =
    await evaluatePacks(input, passTwo, contract, deps);

  // Phase 7: verdict 계산 (모든 cap 병합).
  const { verdict, triggered, rulesStatus } = computeFinalVerdict(
    passTwo,
    effectiveTestStatus,
    reviewStatus,
    evidenceMissing,
    scoreCap,
    rulePackCap,
    workerCap
  );

  // Phase 8: decision JSON 조립.
  const decision = assembleDecision(
    input,
    {
      team,
      codexRaw,
      reviewStatus,
      reviewCritical,
      effectiveTestStatus,
      inferredTestStatus,
      diff,
      cellInputs,
      contract,
      contractInvalid,
      qualityScore,
      workers,
      completedRoles,
      requiredRoles,
      missingWorkers,
      separationViolations,
      workerFindings,
      criticalWorkerFindings,
      rulePackResolve,
      skillPackResolve,
      skillPacks,
      archFindings,
      designFindings,
      triggered,
      rulesStatus,
      passTwo,
      verdict
    },
    deps
  );

  // Phase 9: 출력 파일 + audit event 기록.
  await writeGateOutputs(
    decision,
    verdict.reasons,
    archFindings,
    designFindings,
    passTwo,
    triggered,
    reviewStatus,
    effectiveTestStatus,
    missing,
    rawDiff,
    codexRaw,
    contract,
    diff,
    deps
  );

  return {
    verdict: verdict.verdict,
    reportPath: "REPORT.md",
    decisionPath: ".harness/decision.json",
    triggeredRules: triggered
  };
}
