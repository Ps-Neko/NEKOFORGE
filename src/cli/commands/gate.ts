import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runGate } from "../../core/gate/index.js";
import { runStage } from "./_run.js";

interface GateOpts {
  reviewAdapter?: boolean;
  task?: string;
  testStatus?: string;
}

export function registerGate(program: Command): void {
  program
    .command("gate")
    .description("Compute verdict and write REPORT.md and decision.json")
    .option(
      "--no-review-adapter",
      "ignore review adapter results (verdict capped at PASS_WITH_WARNINGS)"
    )
    .option("--task <id>", "task id to write into decision.json", "TASK-001")
    .option(
      "--test-status <s>",
      "test status to record (passed | failed | not_run | insufficient)",
      "not_run"
    )
    .action(async (opts: GateOpts) => {
      await runStage(
        () =>
          runGate(
            {
              noReviewAdapter: opts.reviewAdapter === false,
              taskId: opts.task ?? "TASK-001",
              testStatus: (opts.testStatus ?? "not_run") as
                | "passed"
                | "failed"
                | "not_run"
                | "insufficient"
            },
            buildDeps()
          ),
        (r) => {
          console.error(`[verdict] ${r.verdict}`);
          console.error(
            `[rules]   ${r.triggeredRules.length ? r.triggeredRules.join(", ") : "(none)"}`
          );
          console.error(`[next]    review REPORT.md → harness apply --approved`);
        }
      );
    });
}
