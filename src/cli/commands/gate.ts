import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runGate } from "../../core/gate/index.js";
import { runStage } from "./_run.js";
import { gateStrictExitCode } from "../../core/gate/verdict.js";

interface GateOpts {
  reviewAdapter?: boolean;
  task?: string;
  testStatus?: string;
  mode?: string;
  strict?: boolean;
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
    .option(
      "--mode <name>",
      "fast | safe | release (release requires benchmark smoke)"
    )
    .option(
      "--strict",
      "exit non-zero when verdict is not a clean PASS (BLOCK/INSUFFICIENT=4, NEEDS_HUMAN/PASS_WITH_WARNINGS=3) — for CI gating"
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
                | "insufficient",
              ...(opts.mode !== undefined
                ? { mode: opts.mode as "fast" | "safe" | "release" }
                : {})
            },
            buildDeps()
          ),
        (r) => {
          console.error(`[verdict] ${r.verdict}`);
          console.error(
            `[rules]   ${r.triggeredRules.length ? r.triggeredRules.join(", ") : "(none)"}`
          );
          if (opts.strict) {
            const code = gateStrictExitCode(r.verdict);
            if (code !== 0) {
              console.error(
                `[strict]  verdict ${r.verdict} is not a clean PASS → exit ${code}`
              );
              process.exit(code);
            }
          }
          console.error(`[next]    review REPORT.md → harness apply --approved`);
        }
      );
    });
}
