/**
 * gate Phase 1-2 — 증거 수집 + artifact 읽기/baseCtx 구성.
 *
 * run-helpers.ts 에서 분리. 제어 흐름·결과값·동작 변경 없음(behavior-preserving).
 */
import type { StageDeps } from "../stage-runner.js";
import { parseUnifiedDiff } from "../../utils/diff.js";
import type { RuleContext } from "../../rules/index.js";
import {
  resolveReviewStatus,
  hasNamedAdapter,
  inferTestStatusFromHooks,
  REQUIRED_EVIDENCE,
  type TeamJson,
  type CodexFindings,
  type HookResultsJson
} from "./evidence.js";
import type {
  GateInput,
  EvidenceCheckResult,
  ArtifactReadResult
} from "./gate-types.js";

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
