/**
 * gate 단계: deterministic rule + review + tests 종합 → verdict.
 * 출력: REPORT.md + .harness/decision.json (schema 검증 통과 필수).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import {
  ALL_RULES,
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
import { parseUnifiedDiff } from "../../utils/diff.js";
import { isoNow } from "../../utils/time.js";
import {
  appendAuditEvent,
  readAuditChain,
  computeAnchor,
  compareAnchor,
  readAuditAnchor,
  writeAuditAnchor
} from "../../utils/audit.js";
import { makeFinding } from "../../rules/types.js";
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
import { collectTaskWorkerResults } from "../../workers/result.js";
import { readRulePacks } from "../../rule-packs/index.js";
import { resolveRulePacks } from "../../rule-packs/resolve.js";
import {
  readSkillPacks,
  resolveSkillPacks
} from "../../skill-packs/index.js";

interface TeamJson {
  pattern?: string;
  agents?: Array<{ id: string; role: string; owns: string[] }>;
}

interface CodexFindings {
  adapterId?: string;
  status: "passed" | "warnings" | "failed" | "not_run";
  findings: Array<{ severity: string; title: string }>;
}

function hasNamedAdapter(c: CodexFindings): boolean {
  return !!c.adapterId && c.adapterId !== "none";
}

const REQUIRED_EVIDENCE = [
  "SPEC.md",
  "PLAN.md",
  "TASKS.md",
  "harness-design.md",
  "team.json",
  "quality-policy.md",
  "rules.json",
  "hooks.json",
  "team-runtime.md",
  "agent-routing.json",
  "worklog.md",
  "quality-contract.json"
] as const;

interface QualityContractJson {
  taskId: string;
  qualityBars: Record<string, { minimum: number; required: boolean }>;
  riskProfile?: { uiTouched?: boolean };
}

interface HookResultsJson {
  results?: Array<{
    hookId?: string;
    status?: string;
    command?: string;
    exitCode?: number;
  }>;
}

/**
 * self-host #6 후속 — work 단계의 post-tool hook 결과에서 `npm test` 류 명령을
 * 찾아 tests.status 자동 추정. CLI 의 --test-status 명시값이 우선.
 */
export function inferTestStatusFromHooks(
  data: HookResultsJson | null
): "passed" | "failed" | "not_run" | null {
  if (!data || !Array.isArray(data.results)) return null;
  const testHook = data.results.find(
    (r) =>
      typeof r.command === "string" &&
      /(^|\s)(npm|yarn|pnpm|bun)\s+(test|run\s+test)\b/.test(r.command)
  );
  if (!testHook) return null;
  if (testHook.status === "ok") return "passed";
  if (testHook.status === "failed") return "failed";
  return null;
}

export interface GateInput {
  noReviewAdapter?: boolean;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  taskId?: string;
  /**
   * Codex self-audit #1 — release mode 시 benchmark smoke 필수.
   * .harness/benchmark-results.json 부재 또는 critical recall < 0.8 이면 verdict 강등.
   */
  mode?: "fast" | "safe" | "release";
}

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
  const missing: string[] = [];
  for (const ev of REQUIRED_EVIDENCE) {
    if (!(await deps.artifact.exists(ev))) missing.push(ev);
  }
  if (!(await deps.artifact.exists("self-review.md"))) missing.push("self-review.md");
  if (!(await deps.artifact.exists("codex-findings.json")))
    missing.push("codex-findings.json");

  const evidenceMissing = missing.length > 0;

  // Codex self-audit #2-3 — factoryCells 가 실제 artifact 존재 반영.
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

  const rawDiff = (await deps.artifact.readMarkdown("last-diff.patch")) ?? "";
  const diff = parseUnifiedDiff(rawDiff);

  const team = (await deps.artifact.readJson<TeamJson>("team.json").catch(() => null)) ?? null;
  const codexRaw = (await deps.artifact.readJson<CodexFindings>("codex-findings.json").catch(() => null)) ?? null;
  const reviewStatus = codexRaw?.status ?? "not_run";
  const reviewCritical = (codexRaw?.findings ?? []).filter(
    (f) => f.severity === "critical"
  ).length;
  const adapterCount = input.noReviewAdapter
    ? 0
    : codexRaw && hasNamedAdapter(codexRaw)
      ? 1
      : 0;

  // self-host #6 후속 — work 의 post-tool hook 결과에서 자동 추정.
  // CLI 의 --test-status 명시값 (input.testStatus) 가 항상 우선.
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

  const passOne = await runAllRulesExceptCodex(baseCtx);
  const highRiskFlags = deriveHighRiskFlags(passOne);
  const ctxWithFlags: RuleContext = { ...baseCtx, highRiskFlags };
  const passTwo = await runAllRules(ctxWithFlags);

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
  await writeAuditAnchor(currentAnchor, deps.cwd);

  // Codex self-audit #1 — release mode 시 benchmark smoke 필수.
  if (input.mode === "release") {
    const benchmark = await deps.artifact
      .readJson<{ totalScenarios: number; criticalRecall: number }>("benchmark-results.json")
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
  const archFindings: RuleFinding[] = [];
  for (const r of ALL_ARCHITECTURE_RULES) {
    archFindings.push(...(await r.run(ctxWithFlags)));
  }
  const designFindings: RuleFinding[] = [];
  for (const r of ALL_DESIGN_RULES) {
    designFindings.push(...(await r.run(ctxWithFlags)));
  }
  // Phase RP-2 — api-safety / dependency-risk / docs / release-evidence /
  // frontend-accessibility rule 추가.
  for (const r of ALL_API_RULES) {
    passTwo.push(...(await r.run(ctxWithFlags)));
  }
  for (const r of ALL_DEPENDENCY_RULES) {
    passTwo.push(...(await r.run(ctxWithFlags)));
  }
  for (const r of ALL_DOCS_RULES) {
    passTwo.push(...(await r.run(ctxWithFlags)));
  }
  for (const r of ALL_RELEASE_EVIDENCE_RULES) {
    passTwo.push(...(await r.run(ctxWithFlags)));
  }
  for (const r of ALL_FRONTEND_RULES) {
    passTwo.push(...(await r.run(ctxWithFlags)));
  }

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
      testStatus: input.testStatus ?? "not_run",
      reviewStatus,
      evidenceComplete: !evidenceMissing,
      qualityBars: contract.qualityBars,
      taskId: contract.taskId,
      uiTouched: contract.riskProfile?.uiTouched === true || detectUiInDiff(diff)
    });
    const requiredFailure = qualityScore.failedQualityBars.some((s) => {
      const bar = s.split(":")[0]!;
      return contract.qualityBars[bar]?.required === true;
    });
    const hint = verdictHintFromScore(qualityScore, requiredFailure);
    scoreCap = hint.capAt;
    await deps.artifact.writeJson("quality-score.json", qualityScore, "quality-score");
    await deps.artifact.writeMarkdown(
      "quality-score.md",
      renderQualityScoreMd(qualityScore, hint.reason)
    );
  }

  // Phase WF — worker factory 평가.
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

  // Phase RP — rule pack / skill pack 평가.
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

  // verdict 영향: missing required rule pack → INSUFFICIENT_EVIDENCE finding.
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

  // verdict 영향: missing required worker → NEEDS_HUMAN_REVIEW or stricter.
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
      workerCap = workerCap === "INSUFFICIENT_EVIDENCE" ? workerCap : "NEEDS_HUMAN_REVIEW";
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

  const verdictBase = computeVerdict({
    findings: passTwo,
    testStatus: input.testStatus ?? "not_run",
    reviewStatus,
    evidenceMissing,
    schemaFailed: false
  });

  // verdict 와 (scoreCap | rulePackCap | workerCap) 중 더 보수적인 것을 채택.
  const allCaps: Array<Verdict | null> = [
    scoreCap,
    rulePackCap,
    workerCap
  ];
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

  const decision = {
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
      summary: inferredTestStatus && !input.testStatus ? "inferred from post-tool hook" : ""
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
              : qualityScore.scores.overall >= qualityScore.thresholds.passWithWarnings
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
        : archFindings.some((f) => f.severity === "high" || f.severity === "warning")
          ? ("warnings" as const)
          : ("passed" as const),
      findingsCount: archFindings.length,
      criticalFindings: archFindings.filter((f) => f.severity === "critical").length
    },
    designReview: contract?.riskProfile?.uiTouched || detectUiInDiff(diff)
      ? {
          status: designFindings.some((f) => f.severity === "critical")
            ? ("failed" as const)
            : designFindings.some((f) => f.severity === "high" || f.severity === "warning")
              ? ("warnings" as const)
              : ("passed" as const),
          findingsCount: designFindings.length,
          criticalFindings: designFindings.filter((f) => f.severity === "critical").length
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
                : "missing") as
            | "complete"
            | "partial"
            | "missing"
            | "violated",
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
      allowed: verdict.verdict === "PASS" || verdict.verdict === "PASS_WITH_WARNINGS",
      reason:
        verdict.verdict === "PASS" || verdict.verdict === "PASS_WITH_WARNINGS"
          ? "verdict permits apply"
          : "apply requires Human Gate or is blocked"
    },
    generatedAt: isoNow(deps.clock)
  };

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
    verdict: verdict.verdict,
    reasons: verdict.reasons,
    triggered,
    reviewStatus,
    testStatus: input.testStatus ?? "not_run",
    missingEvidence: missing,
    findings: passTwo
  });
  await writeFile(join(deps.cwd, "REPORT.md"), report, "utf8");

  await appendAuditEvent(
    {
      type: "gate_verdict",
      verdict: verdict.verdict,
      reason: triggered.length === 0 ? "no triggered rules" : triggered.join(", ")
    },
    deps.cwd
  );

  return {
    verdict: verdict.verdict,
    reportPath: "REPORT.md",
    decisionPath: ".harness/decision.json",
    triggeredRules: triggered
  };
}

async function runAllRules(ctx: RuleContext): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  for (const r of ALL_RULES) {
    const fs = await r.run(ctx);
    out.push(...fs);
  }
  return out;
}

async function runAllRulesExceptCodex(ctx: RuleContext): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  for (const r of ALL_RULES) {
    if (r.id === "codex-missing-risk") continue;
    if (r.id === "auto-apply-block") continue;
    const fs = await r.run(ctx);
    out.push(...fs);
  }
  return out;
}

function deriveHighRiskFlags(findings: readonly RuleFinding[]): NonNullable<RuleContext["highRiskFlags"]> {
  return {
    dangerousFileWrite: findings.some((f) => f.ruleId === "dangerous-file-write"),
    authBypass: findings.some((f) => f.ruleId === "auth-bypass"),
    secretFallback: findings.some((f) => f.ruleId === "secret-fallback"),
    hookInjection: findings.some((f) => f.ruleId === "hook-injection-risk"),
    agentPermissionExpansion: findings.some(
      (f) => f.ruleId === "agent-permission-risk"
    ),
    testDeletion: findings.some((f) => f.ruleId === "test-deletion")
  };
}

function uniqueRuleIds(findings: readonly RuleFinding[]): string[] {
  return Array.from(
    new Set(findings.filter((f) => f.severity !== "info").map((f) => f.ruleId))
  );
}

interface RenderInput {
  verdict: Verdict;
  reasons: string[];
  triggered: string[];
  reviewStatus: string;
  testStatus: string;
  missingEvidence: string[];
  findings: readonly RuleFinding[];
}

function renderReport(r: RenderInput): string {
  return [
    `# REPORT`,
    "",
    `- verdict: **${r.verdict}**`,
    `- triggered rules: ${r.triggered.length > 0 ? r.triggered.join(", ") : "(none)"}`,
    `- review status: ${r.reviewStatus}`,
    `- tests: ${r.testStatus}`,
    r.missingEvidence.length > 0
      ? `- missing evidence: ${r.missingEvidence.join(", ")}`
      : "- evidence: complete",
    "",
    "## Reasons",
    ...r.reasons.map((x) => `- ${x}`),
    "",
    "## Findings",
    r.findings.length === 0
      ? "(none)"
      : r.findings
          .filter((f) => f.severity !== "info")
          .map(
            (f) =>
              `- [${f.severity}] ${f.ruleId}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}`
          )
          .join("\n")
  ].join("\n");
}

const VERDICT_ORDER: Record<Verdict, number> = {
  PASS: 5,
  PASS_WITH_WARNINGS: 4,
  NEEDS_HUMAN_REVIEW: 3,
  BLOCK: 2,
  INSUFFICIENT_EVIDENCE: 1
};

/**
 * 두 verdict 중 더 보수적인 것을 채택 (낮은 order 가 더 엄격).
 */
function applyScoreCap(
  base: { verdict: Verdict; riskLevel: "low" | "medium" | "high" | "critical"; humanApprovalRequired: boolean; reasons: string[] },
  cap: Verdict | null
): typeof base {
  if (!cap) return base;
  if (VERDICT_ORDER[cap] >= VERDICT_ORDER[base.verdict]) return base;
  return {
    verdict: cap,
    riskLevel: cap === "BLOCK" || cap === "INSUFFICIENT_EVIDENCE" ? "critical" : "high",
    humanApprovalRequired: true,
    reasons: [...base.reasons, `quality score cap: ${cap}`]
  };
}

/**
 * Phase WF/RP — 여러 cap (scoreCap, rulePackCap, workerCap) 중 가장 엄격한 것을 채택.
 * 낮은 VERDICT_ORDER 가 더 엄격.
 */
function mergeCap(a: Verdict | null, b: Verdict | null): Verdict | null {
  if (!a) return b;
  if (!b) return a;
  return VERDICT_ORDER[a] <= VERDICT_ORDER[b] ? a : b;
}

/**
 * Phase RP — passTwo findings 의 ruleId 를 enabled pack 으로 역매핑.
 */
function uniqueTriggeredPacks(
  findings: ReadonlyArray<RuleFinding>,
  enabledPacks: ReadonlyArray<string>
): string[] {
  const triggered = new Set<string>();
  const ids = new Set(findings.map((f) => f.ruleId));
  for (const p of enabledPacks) {
    // 동적 import 회피 — 간단한 매칭만.
    if (p === "security-core" && [
      "secret-fallback",
      "auth-bypass",
      "dangerous-file-write",
      "hook-injection-risk",
      "agent-permission-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "test-discipline" && ["test-deletion", "no-test-risk"].some((r) => ids.has(r))) triggered.add(p);
    if (p === "architecture-core" && [
      "large-file-risk",
      "layer-violation",
      "circular-dependency-risk",
      "untyped-api-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "design-web" && [
      "accessibility-risk",
      "design-token-violation",
      "responsive-break-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "release-strict" && [
      "codex-missing-risk",
      "release-benchmark-required",
      "auto-apply-block"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "worker-safety-core" && [
      "worker-safety-risk",
      "worker-role-separation",
      "worker-missing-required",
      "worker-critical-finding",
      "worker-high-finding",
      "worker-factory-missing"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "quality-contract-core" && [
      "quality-contract-invalid",
      "rule-pack-missing"
    ].some((r) => ids.has(r))) triggered.add(p);
  }
  return [...triggered];
}

interface FactoryCellStatusInput {
  hasIntake: boolean;
  hasSpec: boolean;
  hasPlan: boolean;
  hasDesign: boolean;
  hasPolicy: boolean;
  hasTeam: boolean;
  hasWork: boolean;
  hasReview: boolean;
}

function computeFactoryCells(
  i: FactoryCellStatusInput
): Record<string, "complete" | "missing" | "partial"> {
  return {
    product: i.hasSpec ? "complete" : "missing",
    architecture: i.hasDesign ? "complete" : "missing",
    build: i.hasPlan && i.hasTeam && i.hasWork ? "complete" : i.hasPlan ? "partial" : "missing",
    quality: i.hasPolicy ? "complete" : "missing",
    review: i.hasReview ? "complete" : "missing",
    gate: "complete"
  };
}

function renderQualityScoreMd(s: QualityScoreResult, hintReason: string): string {
  return [
    `# QUALITY SCORE — ${s.taskId}`,
    "",
    `Overall: **${s.scores.overall}** (threshold pass=${s.thresholds.pass}, warn=${s.thresholds.passWithWarnings})`,
    "",
    "## Scores",
    ...Object.entries(s.scores)
      .filter(([k]) => k !== "overall")
      .map(([k, v]) => `- ${k}: ${v} (weight ${s.weights[k] ?? "-"})`),
    "",
    "## Failed Quality Bars",
    s.failedQualityBars.length === 0
      ? "(none)"
      : s.failedQualityBars.map((x) => `- ${x}`).join("\n"),
    "",
    "## Reasons",
    s.reasons.length === 0 ? "(none)" : s.reasons.map((x) => `- ${x}`).join("\n"),
    "",
    `Score cap hint: ${hintReason}`
  ].join("\n");
}

// Codex review #3 (Major #3) — UI 변경 자동 감지.
const UI_PATH_RE =
  /\.(tsx|jsx|css|scss|sass|html)$|(^|\/)(components|app|pages|ui)\//i;

function detectUiInDiff(diff: { files: Array<{ path: string }> }): boolean {
  return diff.files.some((f) => UI_PATH_RE.test(f.path));
}

function renderFactoryCellsMd(
  cells: Record<string, "complete" | "missing" | "partial">
): string {
  return [
    "# Factory Cells",
    "",
    "| cell | status |",
    "|---|---|",
    ...Object.entries(cells).map(([k, v]) => `| ${k} | ${v} |`)
  ].join("\n");
}

function renderReviewMd(title: string, findings: readonly RuleFinding[]): string {
  return [
    `# ${title} Review`,
    "",
    `- findings: ${findings.length}`,
    `- critical: ${findings.filter((f) => f.severity === "critical").length}`,
    `- high: ${findings.filter((f) => f.severity === "high").length}`,
    `- warning: ${findings.filter((f) => f.severity === "warning").length}`,
    "",
    "## Findings",
    findings.length === 0
      ? "(none)"
      : findings
          .map(
            (f) =>
              `- [${f.severity}] ${f.ruleId}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}`
          )
          .join("\n")
  ].join("\n");
}
