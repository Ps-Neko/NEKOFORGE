import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runSpec } from "../../core/spec/index.js";
import { runStage } from "./_run.js";

interface SpecOpts {
  nonInteractive?: boolean;
  answers?: string;
}

export function registerSpec(program: Command): void {
  program
    .command("spec")
    .description("Force 7 Gstack-style questions and write SPEC.md")
    .option("--non-interactive", "do not prompt; require --answers")
    .option("--answers <file>", "answers JSON file for non-interactive mode")
    .action(async (opts: SpecOpts) => {
      await runStage(
        () =>
          runSpec(
            {
              nonInteractive: opts.nonInteractive === true,
              ...(opts.answers !== undefined ? { answersFile: opts.answers } : {})
            },
            buildDeps()
          ),
        (r) => {
          console.error(`[ok] ${r.path} saved (${r.answeredCount} answers).`);
          console.error(`[next] harness plan`);
        }
      );
    });
}
