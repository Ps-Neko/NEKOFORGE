import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runWork } from "../../core/work/index.js";
import { runStage } from "./_run.js";

interface WorkOpts {
  diffTool?: string;
  note?: string;
}

export function registerWork(program: Command): void {
  program
    .command("work")
    .description("Log implementation of a single task")
    .argument("<task-id>", "task id from .harness/TASKS.md")
    .option("--diff-tool <tool>", "diff source (git | builtin)", "git")
    .option("--note <text>", "free-form note appended to worklog")
    .action(async (taskId: string, opts: WorkOpts) => {
      await runStage(
        () =>
          runWork(
            { taskId, ...(opts.note !== undefined ? { note: opts.note } : {}) },
            buildDeps()
          ),
        (r) => {
          console.error(
            `[ok] worklog updated for ${taskId} (diff captured=${r.diffCaptured}).`
          );
          console.error(`[next] harness review`);
        }
      );
    });
}
