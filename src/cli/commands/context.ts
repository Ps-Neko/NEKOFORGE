import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runContext } from "../../core/context/index.js";
import { runStage } from "./_run.js";

interface ContextOpts {
  from?: string;
}

export function registerContext(program: Command): void {
  program
    .command("context")
    .description("Summarize domain, structure, and constraints")
    .option("--from <file>", "append user-provided context from a file")
    .action(async (opts: ContextOpts) => {
      await runStage(
        () => runContext(buildDeps(), opts.from ? { fromFile: opts.from } : {}),
        (r) => {
          console.error(`[ok] ${r.path} saved.`);
          console.error(`[next] harness spec`);
        }
      );
    });
}
