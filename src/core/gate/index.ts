/**
 * gate 단계: deterministic rule + review + tests 종합 → verdict.
 * 출력: REPORT.md + .harness/decision.json (schema 검증 통과 필수).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import { ALL_RULES, type RuleContext, type RuleFinding } from "../../rules/index.js";
import { parseUnifiedDiff } from "../../utils/diff.js";
import { isoNow } from "../../utils/time.js";
import { appendAuditEvent } from "../../utils/audit.js";
import { computeVerdict, type Verdict } from "./verdict.js";

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
  "worklog.md"
] as const;

export interface GateInput {
  noReviewAdapter?: boolean;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  taskId?: string;
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

  const verdict = computeVerdict({
    findings: passTwo,
    testStatus: input.testStatus ?? "not_run",
    reviewStatus,
    evidenceMissing,
    schemaFailed: false
  });

  const triggered = uniqueRuleIds(passTwo);
  const hasSerious = passTwo.some(
    (f) => f.severity === "critical" || f.severity === "high"
  );
  const rulesStatus = hasSerious ? ("failed" as const) : ("passed" as const);

  const decision = {
    schemaVersion: "0.3" as const,
    project: "verified-harness",
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
