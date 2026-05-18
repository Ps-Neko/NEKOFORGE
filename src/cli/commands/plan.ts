import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runPlan } from "../../core/plan/index.js";
import { runStage } from "./_run.js";

interface PlanOpts {
  maxTasks?: string;
  requireTests?: boolean;
}

export function registerPlan(program: Command): void {
  program
    .command("plan")
    .description("Break down into TASKS.md (8 columns) with tests and rollback")
    .option("--max-tasks <n>", "upper limit of tasks created", "10")
    .option("--require-tests", "reject tasks with empty tests column")
    .action(async (opts: PlanOpts) => {
      const maxTasks = opts.maxTasks ? Number(opts.maxTasks) : 10;
      await runStage(
        () =>
          runPlan(
            { maxTasks, requireTests: opts.requireTests === true },
            buildDeps()
          ),
        (r) => {
          console.error(`[ok] ${r.planPath} and ${r.tasksPath} saved.`);
          console.error(`[next] harness design`);
        }
      );
    });
}
