/**
 * report 단계 — read-only. 현재 단계와 마지막 verdict 요약.
 */
import type { StageDeps } from "../stage-runner.js";

interface DecisionJson {
  taskId?: string;
  verdict?: string;
  riskLevel?: string;
  humanApprovalRequired?: boolean;
  deterministicRules?: { triggeredRules: string[] };
  teamArchitecture?: { pattern?: string };
}

export interface ReportSnapshot {
  currentStage: string;
  lastVerdict: string | null;
  teamPattern: string | null;
  openFindings: number;
  nextSuggested: string;
  evidence: { report: string; decision: string };
  stagesPresent: string[];
}

export interface ReportInput {
  since?: string;
}

export class ReportInvalidStageError extends Error {
  readonly exitCode = 1;
  constructor(stage: string) {
    super(`unknown stage for --since: ${stage}`);
    this.name = "ReportInvalidStageError";
  }
}

const STAGE_ORDER: Array<[string, string]> = [
  ["intake.md", "intake"],
  ["clarify.md", "clarify"],
  ["context.md", "context"],
  ["SPEC.md", "spec"],
  ["TASKS.md", "plan"],
  ["harness-design.md", "harness-design"],
  ["quality-policy.md", "quality-policy"],
  ["agent-routing.json", "team"],
  ["worklog.md", "work"],
  ["self-review.md", "self-review"],
  ["codex-findings.json", "codex-review"],
  ["decision.json", "gate"],
  ["apply-log.md", "apply"]
];

const NEXT_BY_STAGE: Record<string, string> = {
  uninitialized: "harness init",
  intake: "harness context",
  clarify: "harness context",
  context: "harness spec",
  spec: "harness plan",
  plan: "harness design",
  "harness-design": "harness policy",
  "quality-policy": "harness team",
  team: "harness work <task-id>",
  work: "harness review",
  "self-review": "harness review",
  "codex-review": "harness gate",
  gate: "harness apply --approved",
  apply: "harness report"
};

function stageIndex(stage: string): number {
  return STAGE_ORDER.findIndex(([, s]) => s === stage);
}

export async function runReport(
  deps: StageDeps,
  input: ReportInput = {}
): Promise<ReportSnapshot> {
  let current = "uninitialized";
  const stagesPresent: string[] = [];
  for (const [file, stage] of STAGE_ORDER) {
    if (await deps.artifact.exists(file)) {
      current = stage;
      stagesPresent.push(stage);
    }
  }

  let filtered = stagesPresent;
  if (input.since) {
    const idx = stageIndex(input.since);
    if (idx === -1) throw new ReportInvalidStageError(input.since);
    const sinceStages = STAGE_ORDER.slice(idx).map(([, s]) => s);
    filtered = stagesPresent.filter((s) => sinceStages.includes(s));
  }

  const decision = await deps.artifact
    .readJson<DecisionJson>("decision.json")
    .catch(() => null);

  return {
    currentStage: current,
    lastVerdict: decision?.verdict ?? null,
    teamPattern: decision?.teamArchitecture?.pattern ?? null,
    openFindings: decision?.deterministicRules?.triggeredRules.length ?? 0,
    nextSuggested: NEXT_BY_STAGE[current] ?? "harness report",
    evidence: {
      report: "REPORT.md",
      decision: ".harness/decision.json"
    },
    stagesPresent: filtered
  };
}
