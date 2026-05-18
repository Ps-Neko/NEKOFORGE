import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  runDesign,
  PATTERNS,
  type TeamPattern
} from "../../core/harness-design/index.js";
import { runStage } from "./_run.js";

interface DesignOpts {
  pattern?: string;
  auto?: boolean;
}

export function registerDesign(program: Command): void {
  program
    .command("design")
    .description("Choose team architecture pattern (revfactory-style)")
    .option("--pattern <name>", `team pattern (${PATTERNS.join(" | ")})`)
    .option("--auto", "recommend pattern from domain and plan (reserved)")
    .action(async (opts: DesignOpts) => {
      await runStage(
        () =>
          runDesign(
            {
              ...(opts.pattern !== undefined
                ? { pattern: opts.pattern as TeamPattern }
                : {}),
              auto: opts.auto === true
            },
            buildDeps()
          ),
        (r) => {
          console.error(`[ok] pattern=${r.pattern}; 4 artifacts saved.`);
          console.error(`[next] harness policy`);
        }
      );
    });
}
