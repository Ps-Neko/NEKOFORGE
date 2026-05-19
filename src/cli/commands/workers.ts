/**
 * harness workers <subcommand> — Phase WF.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  getWorkersStatus,
  readWorkers,
  runWorkersInit,
  type WorkerProfile
} from "../../workers/index.js";
import { runStage } from "./_run.js";

export function registerWorkers(program: Command): void {
  const cmd = program
    .command("workers")
    .description("Worker Factory commands (init/list/status/validate)");

  cmd
    .command("init")
    .description("Generate workers.json with a profile")
    .option(
      "--profile <name>",
      "minimal | standard | strict",
      "standard"
    )
    .option("--force", "overwrite existing workers.json", false)
    .action(async (opts: { profile?: string; force?: boolean }) => {
      const profile = (opts.profile ?? "standard") as WorkerProfile;
      await runStage(
        () =>
          runWorkersInit(
            { profile, ...(opts.force ? { force: true } : {}) },
            buildDeps()
          ),
        (r) => {
          console.error(
            `[ok] workers.json (profile=${r.profile}) saved at ${r.workersJsonPath}`
          );
          console.error(
            `[next] harness dispatch <task-id> --worker implementation-worker`
          );
        }
      );
    });

  cmd
    .command("list")
    .description("List configured workers")
    .action(async () => {
      const w = await readWorkers(buildDeps());
      if (!w) {
        console.error("[error] workers.json missing (run `harness workers init`)");
        process.exit(10);
      }
      console.error(`profile: ${w.profile}`);
      for (const x of w.workers) {
        console.error(
          `- ${x.id} [${x.role}] decision=${x.canWriteDecision ? "Y" : "N"} apply=${x.canApply ? "Y" : "N"}`
        );
      }
    });

  cmd
    .command("status")
    .description("Print workers configuration status")
    .action(async () => {
      const s = await getWorkersStatus(buildDeps());
      console.error(`configured: ${s.configured}`);
      if (!s.configured) return;
      console.error(`profile: ${s.profile}`);
      console.error(`workers: ${s.workerCount}`);
      console.error(`roles: ${s.roles.join(", ")}`);
      console.error(
        `roleSeparation: ${s.separationOk ? "ok" : s.separationViolations.join("; ")}`
      );
    });

  cmd
    .command("validate")
    .description("Validate role separation rules")
    .action(async () => {
      const s = await getWorkersStatus(buildDeps());
      if (!s.configured) {
        console.error("[error] workers.json missing");
        process.exit(10);
      }
      if (!s.separationOk) {
        console.error("[error] role separation violation:");
        for (const v of s.separationViolations) console.error(`  - ${v}`);
        process.exit(10);
      }
      console.error("[ok] roles separated correctly.");
    });
}
