import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runIntake } from "../../core/intake/index.js";
import { runClarify } from "../../core/clarify/index.js";
import { runStage } from "./_run.js";

export function registerAsk(program: Command): void {
  program
    .command("ask")
    .description("Save user goal and trigger clarification")
    .argument("<goal>", "user goal in natural language")
    .option("--no-clarify", "skip clarification questions")
    .action(async (goal: string, opts: { clarify?: boolean }) => {
      await runStage(
        async () => {
          const deps = buildDeps();
          const intake = await runIntake({ goal }, deps);
          if (opts.clarify !== false) {
            await runClarify(deps);
          }
          return intake;
        },
        (r) => {
          console.error(`[ok] ${r.path} saved.`);
          console.error(`[next] harness context`);
        }
      );
    });
}
