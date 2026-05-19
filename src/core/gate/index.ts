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

  const baseCtx: RuleContext = {
    diff,
    review: {
      status: reviewStatus,
      adapterCount,
      criticalFindings: reviewCritical
    },
    team: team ?? undefined,
    testStatus: input.testStatus ?? "not_run"
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

  // Phase QF — quality-contract 읽기 + quality-score 계산.
  const contract = await deps.artifact
    .readJson<QualityContractJson>("quality-contract.json", "quality-contract")
    .catch(() => null);
  let qualityScore: QualityScoreResult | null = null;
  let scoreCap: Verdict | null = null;
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
      uiTouched: contract.riskProfile?.uiTouched === true
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

  const verdictBase = computeVerdict({
    findings: passTwo,
    testStatus: input.testStatus ?? "not_run",
    reviewStatus,
    evidenceMissing,
    schemaFailed: false
  });

  // verdict 와 scoreCap 중 더 보수적인 것을 채택.
  const verdict = applyScoreCap(verdictBase, scoreCap);

  const triggered = uniqueRuleIds(passTwo);
  const hasSerious = passTwo.some(
    (f) => f.severity === "critical" || f.severity === "high"
  );
  const rulesStatus = hasSerious ? ("failed" as const) : ("passed" as const);

  const decision = {
    schemaVersion: "0.3" as const,
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
      status: input.testStatus ?? "not_run",
      commands: ["npm test"],
      summary: ""
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
    designReview: contract?.riskProfile?.uiTouched
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
