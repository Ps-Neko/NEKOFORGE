/**
 * apply 단계 — ARCHITECTURE.md §10 의 다층 차단 알고리즘.
 *
 * Layer 1 은 CLI 에서 표면적 체크.
 * 본 모듈은 Layer 2 (schema 재검증 + verdict 재체크 + approval 매칭).
 * Layer 3 은 evaluateAutoApplyBlock 호출.
 */
import type { StageDeps } from "../stage-runner.js";
import { evaluateAutoApplyBlock } from "../../rules/auto-apply-block.js";
import { isoNow } from "../../utils/time.js";
import { appendAuditEvent } from "../../utils/audit.js";
import { readGitDiff } from "../../utils/git.js";
import { runHooks } from "../../hooks/runner.js";
import type { Hook } from "../../hooks/types.js";

interface HooksJson {
  hooks: Hook[];
}

interface DecisionJson {
  taskId: string;
  verdict: string;
  humanApprovalRequired: boolean;
  deterministicRules?: { status?: string; triggeredRules: string[] };
}

function detectTampering(decision: DecisionJson): string | null {
  const triggered = decision.deterministicRules?.triggeredRules ?? [];
  const ruleStatus = decision.deterministicRules?.status;
  const v = decision.verdict;
  if (ruleStatus === "failed" && v === "PASS") {
    return "deterministicRules.status=failed but verdict=PASS";
  }
  if (triggered.length > 0 && v === "PASS") {
    return "verdict=PASS but triggered rules exist";
  }
  return null;
}

export interface ApplyInput {
  approved: boolean;
  dryRun?: boolean;
  /**
   * 테스트용 — 현재 워킹트리 diff 를 반환할 함수.
   * 기본은 `readGitDiff(deps.cwd)` 호출.
   */
  diffReader?: () => string | null;
}

export interface ApplyResult {
  applied: boolean;
  dryRun: boolean;
  reason: string;
  applyLogPath: string;
}

export class ApplyPrecondError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "ApplyPrecondError";
  }
}

export class ApplyApprovalError extends Error {
  readonly exitCode = 3;
  constructor(message: string) {
    super(message);
    this.name = "ApplyApprovalError";
  }
}

export class ApplyDriftError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "ApplyDriftError";
  }
}

export async function runApply(
  input: ApplyInput,
  deps: StageDeps
): Promise<ApplyResult> {
  if (!input.approved) {
    throw new ApplyPrecondError("--approved flag is required for apply");
  }
  const decision = await deps.artifact
    .readJson<DecisionJson>("decision.json", "decision")
    .catch(() => null);
  if (!decision) {
    throw new ApplyPrecondError(
      "decision.json missing or schema invalid (run `harness gate`)"
    );
  }

  const tamper = detectTampering(decision);
  if (tamper) {
    throw new ApplyPrecondError(
      `decision.json appears tampered: ${tamper}`
    );
  }

  evaluateAutoApplyBlock({ verdict: decision.verdict });

  if (decision.verdict === "NEEDS_HUMAN_REVIEW") {
    const approvalText = (await deps.artifact.readMarkdown("approval.txt")) ?? "";
    const ok = approvalLineMatches(approvalText, decision);
    if (!ok) {
      throw new ApplyApprovalError(
        `verdict=NEEDS_HUMAN_REVIEW; .harness/approval.txt missing or token mismatch for ${decision.taskId}`
      );
    }
  }

  // pre-apply hooks (Phase D 후속 — Codex feedback #2)
  const hooksData = await deps.artifact
    .readJson<HooksJson>("hooks.json")
    .catch(() => null);
  const preApply = (hooksData?.hooks ?? []).filter(
    (h) => h.type === "pre-apply"
  );
  const preResults = await runHooks(preApply, {
    stage: "apply",
    cwd: deps.cwd
  });
  const blocking = preResults.find(
    (r) => r.status === "failed" && preApply.find((h) => h.id === r.hookId)?.blocking
  );
  if (blocking) {
    throw new ApplyPrecondError(
      `pre-apply hook "${blocking.hookId}" failed: ${blocking.reason ?? "unknown"}`
    );
  }

  // Codex re-review #2 (Major) — 워킹트리 drift 검증.
  // pending patch 가 있으면 현재 git diff 와 정확히 일치해야 한다.
  // 사용자가 work 이후 추가 변경했거나 부분 revert 했으면 거부.
  const pendingPath = `pending/${decision.taskId}.patch`;
  const pending = await deps.artifact.readMarkdown(pendingPath);
  let patchPromoted = false;
  if (pending !== null) {
    const readDiff = input.diffReader ?? (() => readGitDiff(deps.cwd));
    const current = readDiff() ?? "";
    if (current !== pending) {
      throw new ApplyDriftError(
        `workingtree drifted: current git diff differs from .harness/${pendingPath}. ` +
          `commit/revert/edit since work? re-run 'harness work ${decision.taskId}' or restore the state.`
      );
    }
    // Phase D 후속 (Codex feedback #1) — pending patch → applied 로 격리 이동.
    if (!input.dryRun) {
      await deps.artifact.writeMarkdown(
        `applied/${decision.taskId}.patch`,
        pending
      );
      patchPromoted = true;
    }
  }

  const entry = [
    `## ${decision.taskId} — ${isoNow(deps.clock)}`,
    `- verdict: ${decision.verdict}`,
    `- dryRun: ${input.dryRun === true}`,
    `- triggered rules: ${(decision.deterministicRules?.triggeredRules ?? []).join(", ") || "(none)"}`,
    `- patch: ${patchPromoted ? `applied/${decision.taskId}.patch` : "(none)"}`,
    ""
  ].join("\n");
  const log = (await deps.artifact.readMarkdown("apply-log.md")) ?? "";
  await deps.artifact.writeMarkdown("apply-log.md", log + entry + "\n");

  await appendAuditEvent(
    {
      type: "apply_attempt",
      verdict: decision.verdict,
      reason: input.dryRun === true ? "dry-run" : "applied"
    },
    deps.cwd
  );

  return {
    applied: input.dryRun !== true,
    dryRun: input.dryRun === true,
    reason:
      input.dryRun === true
        ? "dry-run completed; no file changes applied"
        : "apply permitted (verdict + approval ok)",
    applyLogPath: ".harness/apply-log.md"
  };
}

function approvalLineMatches(text: string, decision: DecisionJson): boolean {
  const lines = text.split(/\r?\n/);
  const re = new RegExp(
    `\\bapprove\\s+${escapeRe(decision.taskId)}\\b.*\\bverdict=${escapeRe(decision.verdict)}\\b`
  );
  return lines.some((l) => re.test(l));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
