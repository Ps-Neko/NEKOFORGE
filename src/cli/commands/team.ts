import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runTeam } from "../../core/team/index.js";
import { runStage } from "./_run.js";

export function registerTeam(program: Command): void {
  program
    .command("team")
    .description("Build execution routing and handoff plan (OMC-style)")
    .action(async () => {
      await runStage(
        () => runTeam(buildDeps()),
        (r) => {
          console.error(`[ok] ${r.runtimePath} and ${r.routingPath} saved.`);
          console.error(`[next] harness work <task-id>`);
        }
      );
    });
}
