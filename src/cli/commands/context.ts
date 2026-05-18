import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runContext } from "../../core/context/index.js";
import { runStage } from "./_run.js";

export function registerContext(program: Command): void {
  program
    .command("context")
    .description("Summarize domain, structure, and constraints")
    .option("--from <file>", "load context input from a file (reserved)")
    .action(async () => {
      await runStage(
        () => runContext(buildDeps()),
        (r) => {
          console.error(`[ok] ${r.path} saved.`);
          console.error(`[next] harness spec`);
        }
      );
    });
}
