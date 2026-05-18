import type { Command } from "commander";
import { runInit } from "../../core/init.js";
import { resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runStage } from "./_run.js";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Initialize .harness/ workspace")
    .option("--force", "overwrite existing .harness/")
    .action(async (opts: { force?: boolean }) => {
      await runStage(
        () => runInit({ force: opts.force === true, cwd: resolveWorkspaceCwd() }),
        (r) => {
          console.error(`[ok] ${r.harnessDir} created.`);
          console.error(`[next] harness ask "<goal>"`);
        }
      );
    });
}
