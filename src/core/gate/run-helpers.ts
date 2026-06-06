/**
 * runGate 보조 헬퍼 — gate/index.ts 에서 분리한 위상별 로직.
 *
 * 각 함수는 runGate 의 논리적 단계 하나에 대응하며,
 * 제어 흐름·결과값·동작을 변경하지 않는다(100% behavior-preserving).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import {
  ALL_ARCHITECTURE_RULES,
  ALL_DESIGN_RULES,
  ALL_API_RULES,
  ALL_DEPENDENCY_RULES,
  ALL_DOCS_RULES,
  ALL_RELEASE_EVIDENCE_RULES,
  ALL_FRONTEND_RULES,
  type RuleContext,
  type RuleFinding
} from "../../rules/index.js";
import { parseUnifiedDiff, type Diff } from "../../utils/diff.js";
import { isoNow } from "../../utils/time.js";
import {
  appendAuditEvent,
  readAuditChain,
  computeAnchor,
  compareAnchor,
  detectAnchorTampering,
  readAuditAnchor,
  writeAuditAnchor
} from "../../utils/audit.js";
import { makeFinding } from "../../rules/types.js";
import { canonicalHash } from "../../utils/integrity.js";
import { ENGINE_VERSION } from "../../version.js";
import {
  resolveReviewStatus,
  hasNamedAdapter,
  inferTestStatusFromHooks,
  REQUIRED_EVIDENCE,
  type TeamJson,
  type CodexFindings,
  type QualityContractJson,
  type HookResultsJson
} from "./evidence.js";
import {
  runAllRules,
  runAllRulesExceptCodex,
  deriveHighRiskFlags,
  uniqueRuleIds,
  runRuleList
} from "./rules-run.js";
import { applyScoreCap, mergeCap, uniqueTriggeredPacks } from "./caps.js";
import {
  renderReport,
  computeFactoryCells,
  renderQualityScoreMd,
  detectUiInDiff,
  renderFactoryCellsMd,
  renderReviewMd
} from "./render.js";
import { computeVerdict, type Verdict } from "./verdict.js";
import {
  calculateQualityScore,
  verdictHintFromScore,
  type QualityScoreResult
} from "../../scoring/index.js";
import {
  readWorkers,
  profileRequiredRoles,
  type WorkerProfile
} from "../../workers/index.js";
import {
  validateRoleSeparation,
  detectForbiddenActions
} from "../../workers/validate.js";
import { collectTaskWorkerResults, type WorkerResultJson } from "../../workers/result.js";
import { readRulePacks } from "../../rule-packs/index.js";
import { resolveRulePacks } from "../../rule-packs/resolve.js";
import {
  readSkillPacks,
  resolveSkillPacks
} from "../../skill-packs/index.js";
// GateInput 을 index.ts 에서 import 하면 순환이 생기므로 로컬 정의.
// index.ts 의 GateInput 과 구조적으로 동일해야 한다 (동기화 필수).
export interface GateInput {
  noReviewAdapter?: boolean;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  taskId?: string;
  mode?: "fast" | "safe" | "release";
}

// ── 내부 공유 타입 ──────────────────────────────────────────────────────────

export interface EvidenceCheckResult {
  missing: string[];
  evidenceMissing: boolean;
  cellInputs: {
    hasIntake: boolean;
    hasSpec: boolean;
    hasPlan: boolean;
    hasTasks: boolean;
    hasDesign: boolean;
    hasPolicy: boolean;
    hasTeam: boolean;
    hasWork: boolean;
    hasSelf: boolean;
    hasCodex: boolean;
    hasContract: boolean;
  };
}

export interface ArtifactReadResult {
  rawDiff: string;
  diff: Diff;
  team: TeamJson | null;
  codexRaw: CodexFindings | null;
  reviewStatus: "passed" | "warnings" | "failed" | "not_run";
  reviewCritical: number;
  adapterCount: number;
  inferredTestStatus: "passed" | "failed" | "not_run" | "insufficient" | null;
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient";
  baseCtx: RuleContext;
}

export interface RulesRunResult {
  passTwo: RuleFinding[];
  archFindings: RuleFinding[];
  designFindings: RuleFinding[];
  ctxWithFlags: RuleContext;
}

export interface QualityEvalResult {
  contract: QualityContractJson | null;
  contractInvalid: boolean;
  qualityScore: QualityScoreResult | null;
  scoreCap: Verdict | null;
}

export interface WorkerEvalResult {
  workers: Awaited<ReturnType<typeof readWorkers>>;
  workerResults: Awaited<ReturnType<typeof collectTaskWorkerResults>>;
  completedRoles: string[];
  requiredRoles: string[];
  missingWorkers: string[];
  separationViolations: string[];
  workerFindings: NonNullable<WorkerResultJson["findings"]>;
  criticalWorkerFindings: number;
  highWorkerFindings: number;
  workerCap: Verdict | null;
}

export interface PackEvalResult {
  rulePacks: Awaited<ReturnType<typeof readRulePacks>>;
  skillPacks: Awaited<ReturnType<typeof readSkillPacks>>;
  rulePackResolve: ReturnType<typeof resolveRulePacks> | null;
  skillPackResolve: ReturnType<typeof resolveSkillPacks> | null;
  templateName: string | undefined;
  rulePackCap: Verdict | null;
}

export interface VerdictResult {
  verdict: ReturnType<typeof computeVerdict>;
  triggered: string[];
  hasSerious: boolean;
  rulesStatus: "passed" | "failed";
}

// ── Phase 1: 증거 수집 ──────────────────────────────────────────────────────

export async function checkEvidenceAndCells(
  deps: StageDeps
): Promise<EvidenceCheckResult> {
  const missing: string[] = [];
  for (const ev of REQUIRED_EVIDENCE) {
    if (!(await deps.artifact.exists(ev))) missing.push(ev);
  }
  if (!(await deps.artifact.exists("self-review.md"))) missing.push("self-review.md");
  if (!(await deps.artifact.exists("codex-findings.json")))
    missing.push("codex-findings.json");

  const cellInputs = {
    hasIntake: await deps.artifact.exists("intake.md"),
    hasSpec: await deps.artifact.exists("SPEC.md"),
    hasPlan: await deps.artifact.exists("PLAN.md"),
    hasTasks: await deps.artifact.exists("TASKS.md"),
    hasDesign: await deps.artifact.exists("harness-design.md"),
    hasPolicy: await deps.artifact.exists("quality-policy.md"),
    hasTeam: await deps.artifact.exists("agent-routing.json"),
    hasWork: await deps.artifact.exists("worklog.md"),
    hasSelf: await deps.artifact.exists("self-review.md"),
    hasCodex: await deps.artifact.exists("codex-findings.json"),
    hasContract: await deps.artifact.exists("quality-contract.json")
  };

  return { missing, evidenceMissing: missing.length > 0, cellInputs };
}

// ── Phase 2: artifact 읽기 + baseCtx 구성 ───────────────────────────────────

export async function readArtifactsAndBuildCtx(
  input: GateInput,
  deps: StageDeps
): Promise<ArtifactReadResult> {
  const rawDiff = (await deps.artifact.readMarkdown("last-diff.patch")) ?? "";
  const diff = parseUnifiedDiff(rawDiff);

  const team =
    (await deps.artifact.readJson<TeamJson>("team.json").catch(() => null)) ?? null;
  const codexRaw =
    (await deps.artifact
      .readJson<CodexFindings>("codex-findings.json")
      .catch(() => null)) ?? null;
  const reviewStatus = resolveReviewStatus(
    input.noReviewAdapter ?? false,
    codexRaw?.status
  );
  const reviewCritical = (codexRaw?.findings ?? []).filter(
    (f) => f.severity === "critical"
  ).length;
  const adapterCount = input.noReviewAdapter
    ? 0
    : codexRaw && hasNamedAdapter(codexRaw)
      ? 1
      : 0;

  const hookResults = await deps.artifact
    .readJson<HookResultsJson>("hook-results.json")
    .catch(() => null);
  const inferredTestStatus = inferTestStatusFromHooks(hookResults);
  const effectiveTestStatus =
    input.testStatus ?? inferredTestStatus ?? "not_run";

  const baseCtx: RuleContext = {
    diff,
    review: {
      status: reviewStatus,
      adapterCount,
      criticalFindings: reviewCritical
    },
    team: team ?? undefined,
    testStatus: effectiveTestStatus
  };

  return {
    rawDiff,
    diff,
    team,
    codexRaw,
    reviewStatus,
    reviewCritical,
    adapterCount,
    inferredTestStatus,
    effectiveTestStatus,
    baseCtx
  };
}

// ── Phase 3: 규칙 실행 + audit 검증 + release benchmark ─────────────────────

export async function runRulesAndAudit(
  input: GateInput,
  baseCtx: RuleContext,
  deps: StageDeps
): Promise<RulesRunResult> {
  const passOne = await runAllRulesExceptCodex(baseCtx, deps.cwd);
  const highRiskFlags = deriveHighRiskFlags(passOne);
  const ctxWithFlags: RuleContext = { ...baseCtx, highRiskFlags };
  const passTwo = await runAllRules(ctxWithFlags, deps.cwd);

  // audit.jsonl chain 무결성 검증 (SECURITY.md §9).
  const auditChain = await readAuditChain(deps.cwd);
  if (!auditChain.valid) {
    passTwo.push(
      makeFinding(
        "audit-integrity",
        "high",
        `audit.jsonl chain broken at line ${auditChain.brokenAtLine}: ${auditChain.reason}`
      )
    );
  }
  // audit anchor 비교 — 이전 anchor 가 있으면 append-only 위반 감지.
  const prevAnchor = await readAuditAnchor(deps.cwd);
  const currentAnchor = computeAnchor(auditChain.rawText, isoNow(deps.clock));
  const anchorCmp = compareAnchor(prevAnchor, currentAnchor);
  if (!anchorCmp.match) {
    passTwo.push(
      makeFinding(
        "audit-integrity",
        "high",
        `audit anchor mismatch: ${anchorCmp.reason}`
      )
    );
  }
  // 2,7 — anchor 재작성/삭제 감지(prevAnchor 또는 prior gate_verdict 있을 때만 발화).
  const anchorTamper = detectAnchorTampering(prevAnchor, auditChain.rawText);
  if (anchorTamper) {
    passTwo.push(makeFinding("audit-integrity", "high", anchorTamper));
  }
  await writeAuditAnchor(currentAnchor, deps.cwd);

  // Codex self-audit #1 — release mode 시 benchmark smoke 필수.
  if (input.mode === "release") {
    const benchmark = await deps.artifact
      .readJson<{ totalScenarios: number; criticalRecall: number }>(
        "benchmark-results.json"
      )
      .catch(() => null);
    if (!benchmark || benchmark.totalScenarios === 0) {
      passTwo.push(
        makeFinding(
          "release-benchmark-required",
          "high",
          "release mode requires .harness/benchmark-results.json (run `harness benchmark`)"
        )
      );
    } else if (benchmark.criticalRecall < 0.8) {
      passTwo.push(
        makeFinding(
          "release-benchmark-required",
          "high",
          `release mode requires benchmark critical recall >= 0.8 (current ${benchmark.criticalRecall.toFixed(2)})`
        )
      );
    }
  }

  // Phase QF — architecture/design rule 별도 실행.
  const archFindings = await runRuleList(ALL_ARCHITECTURE_RULES, ctxWithFlags);
  const designFindings = await runRuleList(ALL_DESIGN_RULES, ctxWithFlags);
  // Phase RP-2 — api-safety / dependency-risk / docs / release-evidence /
  // frontend-accessibility rule 추가.
  passTwo.push(...(await runRuleList(ALL_API_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_DEPENDENCY_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_DOCS_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_RELEASE_EVIDENCE_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_FRONTEND_RULES, ctxWithFlags)));

  return { passTwo, archFindings, designFindings, ctxWithFlags };
}

// ── Phase 4: quality-contract + quality-score 평가 ──────────────────────────

export async function evaluateQualityContract(
  passTwo: RuleFinding[],
  archFindings: RuleFinding[],
  designFindings: RuleFinding[],
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  evidenceMissing: boolean,
  diff: Diff,
  deps: StageDeps
): Promise<QualityEvalResult> {
  // Phase QF — quality-contract 읽기 + quality-score 계산.
  // Codex review #3 (Critical #2) — schema invalid 와 not found 구분.
  let contract: QualityContractJson | null = null;
  let contractInvalid = false;
  if (await deps.artifact.exists("quality-contract.json")) {
    try {
      contract = await deps.artifact.readJson<QualityContractJson>(
        "quality-contract.json",
        "quality-contract"
      );
    } catch {
      // schema 위반 — gate verdict 를 INSUFFICIENT_EVIDENCE 로 강등.
      contractInvalid = true;
      passTwo.push(
        makeFinding(
          "quality-contract-invalid",
          "critical",
          "quality-contract.json fails schema validation"
        )
      );
    }
  }
  let qualityScore: QualityScoreResult | null = null;
  let scoreCap: Verdict | null = contractInvalid ? "INSUFFICIENT_EVIDENCE" : null;
  if (contract) {
    qualityScore = calculateQualityScore({
      findings: passTwo,
      architectureFindings: archFindings,
      designFindings,
      testStatus: effectiveTestStatus,
      reviewStatus,
      evidenceComplete: !evidenceMissing,
      qualityBars: contract.qualityBars,
      taskId: contract.taskId,
      uiTouched:
        contract.riskProfile?.uiTouched === true || detectUiInDiff(diff)
    });
    const requiredFailure = qualityScore.failedQualityBars.some((s) => {
      const bar = s.split(":")[0]!;
      return contract!.qualityBars[bar]?.required === true;
    });
    const hint = verdictHintFromScore(qualityScore, requiredFailure);
    scoreCap = hint.capAt;
    await deps.artifact.writeJson(
      "quality-score.json",
      qualityScore,
      "quality-score"
    );
    await deps.artifact.writeMarkdown(
      "quality-score.md",
      renderQualityScoreMd(qualityScore, hint.reason)
    );
  }

  return { contract, contractInvalid, qualityScore, scoreCap };
}

// ── Phase 5: worker factory 평가 ────────────────────────────────────────────

export async function evaluateWorkerFactory(
  input: GateInput,
  passTwo: RuleFinding[],
  deps: StageDeps
): Promise<WorkerEvalResult> {
  const workers = await readWorkers(deps);
  const workerResults = workers
    ? await collectTaskWorkerResults(input.taskId ?? "TASK-001", deps)
    : [];
  const completedRoles = workerResults
    .filter((r) => r.status === "completed")
    .map((r) => r.role);
  const requiredRoles = workers
    ? profileRequiredRoles(workers.profile as WorkerProfile)
    : [];
  const missingWorkers = requiredRoles.filter(
    (r) => !completedRoles.includes(r)
  );
  const separationViolations = workers
    ? validateRoleSeparation(workers.workers, workers.roleSeparation)
    : [];
  const workerFindings = workerResults.flatMap((r) => r.findings ?? []);
  const criticalWorkerFindings = workerFindings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highWorkerFindings = workerFindings.filter(
    (f) => f.severity === "high"
  ).length;

  // worker-safety — body 안에 forbidden action 패턴이 있으면 critical.
  for (const wr of workerResults) {
    const resultPath = wr.evidence?.result;
    if (!resultPath) continue;
    const body =
      (await deps.artifact.readMarkdown(
        resultPath.replace(/^\.harness\//, "")
      )) ?? "";
    const hits = detectForbiddenActions(body);
    if (hits.length > 0) {
      passTwo.push(
        makeFinding(
          "worker-safety-risk",
          "critical",
          `worker ${wr.role} body contains forbidden action: ${hits.map((h) => h.rule).join(", ")}`
        )
      );
    }
  }

  let workerCap: Verdict | null = null;
  if (workers) {
    if (missingWorkers.length > 0) {
      const sec = missingWorkers.includes("security-reviewer");
      if (input.mode === "release" && sec) {
        workerCap = "INSUFFICIENT_EVIDENCE";
      } else {
        workerCap = "NEEDS_HUMAN_REVIEW";
      }
      const taskId = input.taskId ?? "TASK-001";
      const fixHints = missingWorkers
        .map(
          (w) =>
            `dispatch+import ${w}: harness dispatch ${taskId} --worker ${w} → harness worker-result import ${taskId} --worker ${w} --file <result.md>`
        )
        .join("; ");
      passTwo.push(
        makeFinding(
          "worker-missing-required",
          input.mode === "release" && sec ? "critical" : "high",
          `required worker(s) missing: ${missingWorkers.join(", ")}. Fix: ${fixHints}`
        )
      );
    }
    if (separationViolations.length > 0) {
      workerCap =
        workerCap === "INSUFFICIENT_EVIDENCE" ? workerCap : "NEEDS_HUMAN_REVIEW";
      passTwo.push(
        makeFinding(
          "worker-role-separation",
          "high",
          `role separation violation: ${separationViolations.join("; ")}`
        )
      );
    }
    if (criticalWorkerFindings > 0) {
      passTwo.push(
        makeFinding(
          "worker-critical-finding",
          "critical",
          `${criticalWorkerFindings} critical worker finding(s) reported`
        )
      );
    } else if (highWorkerFindings > 0) {
      passTwo.push(
        makeFinding(
          "worker-high-finding",
          "high",
          `${highWorkerFindings} high worker finding(s) reported`
        )
      );
    }
  } else if (input.mode === "release") {
    // release mode 인데 workers.json 없으면 INSUFFICIENT_EVIDENCE.
    workerCap = "INSUFFICIENT_EVIDENCE";
    passTwo.push(
      makeFinding(
        "worker-factory-missing",
        "critical",
        "release mode requires workers.json (run `harness workers init --profile strict`)"
      )
    );
  }

  return {
    workers,
    workerResults,
    completedRoles,
    requiredRoles,
    missingWorkers,
    separationViolations,
    workerFindings,
    criticalWorkerFindings,
    highWorkerFindings,
    workerCap
  };
}

// ── Phase 6: rule pack / skill pack 평가 ────────────────────────────────────

export async function evaluatePacks(
  input: GateInput,
  passTwo: RuleFinding[],
  contract: QualityContractJson | null,
  deps: StageDeps
): Promise<PackEvalResult> {
  const rulePacks = await readRulePacks(deps);
  const skillPacks = await readSkillPacks(deps);
  const templateName =
    contract && "template" in contract
      ? ((contract as { template?: string }).template ?? undefined)
      : undefined;
  const rulePackResolve = rulePacks
    ? resolveRulePacks({
        packs: rulePacks,
        template: templateName,
        mode: input.mode
      })
    : null;
  const skillPackResolve =
    skillPacks && templateName
      ? resolveSkillPacks(skillPacks, templateName)
      : null;

  let rulePackCap: Verdict | null = null;
  if (rulePackResolve && rulePackResolve.missingRequired.length > 0) {
    passTwo.push(
      makeFinding(
        "rule-pack-missing",
        "critical",
        `required rule pack missing: ${rulePackResolve.missingRequired.join(", ")}`
      )
    );
    rulePackCap = "INSUFFICIENT_EVIDENCE";
    // web-ui + design-web 누락은 NEEDS_HUMAN_REVIEW 수준으로 약화.
    if (
      templateName === "web-ui" &&
      rulePackResolve.missingRequired.length === 1 &&
      rulePackResolve.missingRequired[0] === "design-web"
    ) {
      rulePackCap = "NEEDS_HUMAN_REVIEW";
    }
  }

  return {
    rulePacks,
    skillPacks,
    rulePackResolve,
    skillPackResolve,
    templateName,
    rulePackCap
  };
}

// ── Phase 7: verdict 계산 ────────────────────────────────────────────────────

export function computeFinalVerdict(
  passTwo: RuleFinding[],
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  evidenceMissing: boolean,
  scoreCap: Verdict | null,
  rulePackCap: Verdict | null,
  workerCap: Verdict | null
): VerdictResult {
  const verdictBase = computeVerdict({
    findings: passTwo,
    testStatus: effectiveTestStatus,
    reviewStatus,
    evidenceMissing,
    schemaFailed: false
  });

  const allCaps: Array<Verdict | null> = [scoreCap, rulePackCap, workerCap];
  const strictestCap = allCaps.reduce<Verdict | null>(
    (acc, cap) => mergeCap(acc, cap),
    null
  );
  const verdict = applyScoreCap(verdictBase, strictestCap);

  const triggered = uniqueRuleIds(passTwo);
  const hasSerious = passTwo.some(
    (f) => f.severity === "critical" || f.severity === "high"
  );
  const rulesStatus = hasSerious ? ("failed" as const) : ("passed" as const);

  return { verdict, triggered, hasSerious, rulesStatus };
}

// ── Phase 8: decision JSON 조립 ──────────────────────────────────────────────

export function assembleDecision(
  input: GateInput,
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
  }: {
    team: TeamJson | null;
    codexRaw: CodexFindings | null;
    reviewStatus: "passed" | "warnings" | "failed" | "not_run";
    reviewCritical: number;
    effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient";
    inferredTestStatus: "passed" | "failed" | "not_run" | "insufficient" | null;
    diff: Diff;
    cellInputs: EvidenceCheckResult["cellInputs"];
    contract: QualityContractJson | null;
    contractInvalid: boolean;
    qualityScore: QualityScoreResult | null;
    workers: Awaited<ReturnType<typeof readWorkers>>;
    completedRoles: string[];
    requiredRoles: string[];
    missingWorkers: string[];
    separationViolations: string[];
    workerFindings: NonNullable<WorkerResultJson["findings"]>;
    criticalWorkerFindings: number;
    rulePackResolve: ReturnType<typeof resolveRulePacks> | null;
    skillPackResolve: ReturnType<typeof resolveSkillPacks> | null;
    skillPacks: Awaited<ReturnType<typeof readSkillPacks>>;
    archFindings: RuleFinding[];
    designFindings: RuleFinding[];
    triggered: string[];
    rulesStatus: "passed" | "failed";
    passTwo: RuleFinding[];
    verdict: ReturnType<typeof computeVerdict>;
  },
  deps: StageDeps
) {
  return {
    schemaVersion: "0.5" as const,
    project: "nekoforge",
    taskId: input.taskId ?? "TASK-UNKNOWN",
    workflowStage: "gate",
    verdict: verdict.verdict,
    riskLevel: verdict.riskLevel,
    humanApprovalRequired: verdict.humanApprovalRequired,
    humanApproved: false,
    teamArchitecture: {
      pattern: team?.pattern ?? "Pipeline",
      agents: team?.agents ?? [],
      orchestrator: ".harness/orchestrator.md"
    },
    qualityPolicy: {
      rules: ".harness/rules.json",
      hooks: ".harness/hooks.json",
      contextPolicy: ".harness/context-policy.md",
      status: "applied" as const,
      violations: []
    },
    tests: {
      status: effectiveTestStatus,
      commands: ["npm test"],
      summary:
        inferredTestStatus && !input.testStatus
          ? "inferred from post-tool hook"
          : ""
    },
    reviewAdapters: [
      {
        adapterId: codexRaw ? "codex" : "none",
        status: reviewStatus,
        findingsCount: codexRaw?.findings.length ?? 0,
        criticalFindings: reviewCritical,
        summary: ""
      }
    ],
    deterministicRules: {
      status: rulesStatus,
      triggeredRules: triggered
    },
    qualityContract: contract
      ? {
          path: ".harness/quality-contract.json",
          status: "valid" as const,
          failedBars: qualityScore?.failedQualityBars ?? []
        }
      : contractInvalid
        ? {
            path: ".harness/quality-contract.json",
            status: "violated" as const,
            failedBars: []
          }
        : {
            path: ".harness/quality-contract.json",
            status: "missing" as const,
            failedBars: []
          },
    qualityScore: qualityScore
      ? {
          path: ".harness/quality-score.json",
          overall: qualityScore.scores.overall,
          minimumRequired: qualityScore.thresholds.pass,
          status:
            qualityScore.scores.overall >= qualityScore.thresholds.pass
              ? ("passed" as const)
              : qualityScore.scores.overall >=
                  qualityScore.thresholds.passWithWarnings
                ? ("warning" as const)
                : ("failed" as const)
        }
      : {
          path: ".harness/quality-score.json",
          overall: 0,
          minimumRequired: 0,
          status: "failed" as const
        },
    factoryCells: computeFactoryCells({
      hasIntake: cellInputs.hasIntake,
      hasSpec: cellInputs.hasSpec,
      hasPlan: cellInputs.hasPlan && cellInputs.hasTasks,
      hasDesign: cellInputs.hasDesign,
      hasPolicy: cellInputs.hasPolicy && cellInputs.hasContract,
      hasTeam: cellInputs.hasTeam,
      hasWork: cellInputs.hasWork,
      hasReview: cellInputs.hasSelf && cellInputs.hasCodex
    }),
    architectureReview: {
      status: archFindings.some((f) => f.severity === "critical")
        ? ("failed" as const)
        : archFindings.some(
              (f) => f.severity === "high" || f.severity === "warning"
            )
          ? ("warnings" as const)
          : ("passed" as const),
      findingsCount: archFindings.length,
      criticalFindings: archFindings.filter((f) => f.severity === "critical")
        .length
    },
    designReview:
      contract?.riskProfile?.uiTouched || detectUiInDiff(diff)
        ? {
            status: designFindings.some((f) => f.severity === "critical")
              ? ("failed" as const)
              : designFindings.some(
                    (f) =>
                      f.severity === "high" || f.severity === "warning"
                  )
                ? ("warnings" as const)
                : ("passed" as const),
            findingsCount: designFindings.length,
            criticalFindings: designFindings.filter(
              (f) => f.severity === "critical"
            ).length
          }
        : {
            status: "not_applicable" as const,
            findingsCount: 0,
            criticalFindings: 0
          },
    workerFactory: workers
      ? {
          status: (separationViolations.length > 0
            ? "violated"
            : missingWorkers.length === 0
              ? "complete"
              : missingWorkers.length < requiredRoles.length
                ? "partial"
                : "missing") as "complete" | "partial" | "missing" | "violated",
          profile: workers.profile,
          requiredWorkers: requiredRoles,
          completedWorkers: completedRoles,
          missingWorkers,
          roleSeparationViolations: separationViolations,
          workerFindingsCount: workerFindings.length,
          criticalWorkerFindings
        }
      : {
          status: "missing" as const,
          profile: "",
          requiredWorkers: [],
          completedWorkers: [],
          missingWorkers: [],
          roleSeparationViolations: [],
          workerFindingsCount: 0,
          criticalWorkerFindings: 0
        },
    rulePacks: rulePackResolve
      ? {
          status: (rulePackResolve.missingRequired.length > 0
            ? "missing"
            : "complete") as "complete" | "missing" | "violated",
          enabled: rulePackResolve.enabled,
          required: rulePackResolve.required,
          missingRequired: rulePackResolve.missingRequired,
          triggeredPacks: uniqueTriggeredPacks(passTwo, rulePackResolve.enabled)
        }
      : {
          status: "missing" as const,
          enabled: [],
          required: [],
          missingRequired: [],
          triggeredPacks: []
        },
    skillPacks: skillPackResolve
      ? {
          status: (skillPackResolve.missingRecommended.length > 0
            ? "partial"
            : "complete") as "complete" | "missing" | "partial",
          enabled: skillPackResolve.enabled,
          recommended: skillPackResolve.recommended,
          missingRecommended: skillPackResolve.missingRecommended
        }
      : skillPacks
        ? {
            status: "complete" as const,
            enabled: skillPacks.enabledPacks,
            recommended: [],
            missingRecommended: []
          }
        : {
            status: "missing" as const,
            enabled: [],
            recommended: [],
            missingRecommended: []
          },
    evidence: {
      intake: ".harness/intake.md",
      clarify: ".harness/clarify.md",
      context: ".harness/context.md",
      spec: ".harness/SPEC.md",
      plan: ".harness/PLAN.md",
      tasks: ".harness/TASKS.md",
      harnessDesign: ".harness/harness-design.md",
      qualityPolicy: ".harness/quality-policy.md",
      teamRuntime: ".harness/team-runtime.md",
      selfReview: ".harness/self-review.md",
      codexReview: ".harness/codex-review.md",
      report: "REPORT.md"
    },
    apply: {
      allowed:
        verdict.verdict === "PASS" || verdict.verdict === "PASS_WITH_WARNINGS",
      reason:
        verdict.verdict === "PASS" || verdict.verdict === "PASS_WITH_WARNINGS"
          ? "verdict permits apply"
          : "apply requires Human Gate or is blocked"
    },
    generatedAt: isoNow(deps.clock)
  };
}

// ── Phase 9: 출력 파일 쓰기 + audit event 기록 ──────────────────────────────

export async function writeGateOutputs(
  decision: ReturnType<typeof assembleDecision>,
  verdictReasons: string[],
  archFindings: RuleFinding[],
  designFindings: RuleFinding[],
  passTwo: RuleFinding[],
  triggered: string[],
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  missing: string[],
  rawDiff: string,
  codexRaw: CodexFindings | null,
  contract: QualityContractJson | null,
  diff: Diff,
  deps: StageDeps
): Promise<void> {
  await deps.artifact.writeJson("decision.json", decision, "decision");

  // Codex review #3 (Major #4) — 별도 산출 파일 작성.
  await deps.artifact.writeJson("factory-cells.json", {
    schemaVersion: "0.5",
    cells: decision.factoryCells
  });
  await deps.artifact.writeMarkdown(
    "factory-cells.md",
    renderFactoryCellsMd(decision.factoryCells)
  );
  await deps.artifact.writeJson("architecture-findings.json", {
    schemaVersion: "0.5",
    findings: archFindings,
    summary: `${archFindings.length} architecture findings (${archFindings.filter((f) => f.severity === "critical").length} critical)`
  });
  await deps.artifact.writeMarkdown(
    "architecture-review.md",
    renderReviewMd("Architecture", archFindings)
  );
  await deps.artifact.writeJson("design-findings.json", {
    schemaVersion: "0.5",
    findings: designFindings,
    summary: `${designFindings.length} design findings (uiTouched: ${contract?.riskProfile?.uiTouched === true || detectUiInDiff(diff)})`
  });
  await deps.artifact.writeMarkdown(
    "design-review.md",
    renderReviewMd("Design", designFindings)
  );

  const report = renderReport({
    verdict: decision.verdict,
    reasons: verdictReasons,
    triggered,
    reviewStatus,
    testStatus: effectiveTestStatus,
    missingEvidence: missing,
    findings: passTwo
  });
  await writeFile(join(deps.cwd, "REPORT.md"), report, "utf8");

  await appendAuditEvent(
    {
      type: "gate_verdict",
      verdict: decision.verdict,
      reason:
        triggered.length === 0 ? "no triggered rules" : triggered.join(", "),
      decisionHash: canonicalHash(decision),
      inputDiffHash: canonicalHash(rawDiff),
      engineVersion: ENGINE_VERSION,
      ...(codexRaw ? { codexFindingsHash: canonicalHash(codexRaw) } : {})
    },
    deps.cwd
  );
}
