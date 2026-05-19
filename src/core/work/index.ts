import type { StageDeps } from "../stage-runner.js";
import { readGitDiff, diffHash } from "../../utils/git.js";
import { isoNow } from "../../utils/time.js";
import { runHooks } from "../../hooks/runner.js";
import type { Hook, HookType } from "../../hooks/types.js";
import { lintProductIntent } from "../../utils/quality-contract-lint.js";

interface QualityContractMinimal {
  productIntent: {
    user: string;
    problem: string;
    coreValue: string;
  };
}

export interface WorkInput {
  taskId: string;
  note?: string;
}

export interface WorkResult {
  worklogPath: string;
  diffHash: string;
  diffCaptured: boolean;
}

export class WorkPrecondError extends Error {
  readonly exitCode = 10;
  constructor(message: string) {
    super(message);
    this.name = "WorkPrecondError";
  }
}

export class WorkDuplicateError extends Error {
  readonly exitCode = 11;
  constructor(taskId: string) {
    super(`task ${taskId} is already recorded in worklog`);
    this.name = "WorkDuplicateError";
  }
}

export class WorkHookError extends Error {
  readonly exitCode = 10;
  constructor(hookId: string, reason: string) {
    super(`pre-tool hook "${hookId}" failed: ${reason}`);
    this.name = "WorkHookError";
  }
}

interface HooksJson {
  hooks: Hook[];
}

async function loadHooks(
  deps: StageDeps,
  type: HookType
): Promise<Hook[]> {
  const data = await deps.artifact
    .readJson<HooksJson>("hooks.json")
    .catch(() => null);
  if (!data) return [];
  return (data.hooks ?? []).filter((h) => h.type === type);
}

export async function runWork(
  input: WorkInput,
  deps: StageDeps
): Promise<WorkResult> {
  if (!(await deps.artifact.exists("TASKS.md"))) {
    throw new WorkPrecondError("TASKS.md missing (run `harness plan`)");
  }
  if (!(await deps.artifact.exists("agent-routing.json"))) {
    throw new WorkPrecondError(
      "agent-routing.json missing (run `harness team`)"
    );
  }
  // Phase QF — Quality Contract before Work.
  if (!(await deps.artifact.exists("quality-contract.json"))) {
    throw new WorkPrecondError(
      "quality-contract.json missing (run `harness contract`)"
    );
  }
  // Codex self-audit #2-1 — work 진입 시 productIntent placeholder 도 거부.
  const contract = await deps.artifact
    .readJson<QualityContractMinimal>("quality-contract.json")
    .catch(() => null);
  if (contract) {
    const lintErrors = lintProductIntent(contract.productIntent);
    if (lintErrors.length > 0) {
      throw new WorkPrecondError(
        `quality-contract.json has unfilled productIntent: ${lintErrors.join(", ")} ` +
          `(re-run 'harness contract --answers <file>' or edit .harness/quality-contract.json)`
      );
    }
  }

  const tasksDoc = (await deps.artifact.readMarkdown("TASKS.md")) ?? "";
  if (!new RegExp(`\\b${input.taskId}\\b`).test(tasksDoc)) {
    throw new WorkPrecondError(
      `task ${input.taskId} not found in TASKS.md`
    );
  }

  const worklog = (await deps.artifact.readMarkdown("worklog.md")) ?? "";
  const completedRe = new RegExp(
    `^## ${input.taskId} .*completed\\b`,
    "m"
  );
  if (completedRe.test(worklog)) {
    throw new WorkDuplicateError(input.taskId);
  }

  // pre-tool hooks (Phase D 후속 — Codex feedback #2)
  const preHooks = await loadHooks(deps, "pre-tool");
  const preResults = await runHooks(preHooks, {
    stage: "work",
    cwd: deps.cwd
  });
  const blockingFailure = preResults.find(
    (r) => r.status === "failed" && preHooks.find((h) => h.id === r.hookId)?.blocking
  );
  if (blockingFailure) {
    throw new WorkHookError(
      blockingFailure.hookId,
      blockingFailure.reason ?? "unknown"
    );
  }

  const rawDiff = readGitDiff(deps.cwd);
  const captured = rawDiff !== null;
  const text = rawDiff ?? "";
  const hash = diffHash(text);
  if (captured) {
    await deps.artifact.writeMarkdown("last-diff.patch", text);
    // Phase D 후속 (Codex feedback #1) — task 별 pending patch 격리.
    await deps.artifact.writeMarkdown(`pending/${input.taskId}.patch`, text);
  }

  const at = isoNow(deps.clock);
  const entry = [
    `## ${input.taskId} — ${at}`,
    `- diff hash: ${hash}`,
    `- diff captured: ${captured}`,
    input.note ? `- note: ${input.note}` : null,
    ""
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  await deps.artifact.writeMarkdown("worklog.md", worklog + entry + "\n");

  // post-tool hooks (Phase D 후속 — non-blocking 으로 결과만 기록)
  const postHooks = await loadHooks(deps, "post-tool");
  await runHooks(postHooks, { stage: "work", cwd: deps.cwd });

  return {
    worklogPath: ".harness/worklog.md",
    diffHash: hash,
    diffCaptured: captured
  };
}
