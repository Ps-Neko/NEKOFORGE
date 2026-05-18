import type { StageDeps } from "../stage-runner.js";
import { readGitDiff, diffHash } from "../../utils/git.js";
import { isoNow } from "../../utils/time.js";

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

  const rawDiff = readGitDiff(deps.cwd);
  const captured = rawDiff !== null;
  const text = rawDiff ?? "";
  const hash = diffHash(text);
  if (captured) {
    await deps.artifact.writeMarkdown("last-diff.patch", text);
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

  return {
    worklogPath: ".harness/worklog.md",
    diffHash: hash,
    diffCaptured: captured
  };
}
