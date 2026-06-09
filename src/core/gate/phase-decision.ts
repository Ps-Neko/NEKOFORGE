/**
 * gate Phase 8 — decision.json 객체 조립(schema 0.5).
 *
 * run-helpers.ts 에서 분리. 제어 흐름·결과값·동작 변경 없음(behavior-preserving).
 */
import type { StageDeps } from "../stage-runner.js";
import type { RuleFinding } from "../../rules/index.js";
import { isoNow } from "../../utils/time.js";
import type { Diff } from "../../utils/diff.js";
import type { QualityScoreResult } from "../../scoring/index.js";
import type { readWorkers } from "../../workers/index.js";
import type { WorkerResultJson } from "../../workers/result.js";
import type { resolveRulePacks } from "../../rule-packs/resolve.js";
import type { readSkillPacks, resolveSkillPacks } from "../../skill-packs/index.js";
import { computeFactoryCells, detectUiInDiff } from "./render.js";
import { uniqueTriggeredPacks } from "./caps.js";
import type { computeVerdict } from "./verdict.js";
import type {
  TeamJson,
  CodexFindings,
  QualityContractJson
} from "./evidence.js";
import type { GateInput, EvidenceCheckResult } from "./gate-types.js";

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
