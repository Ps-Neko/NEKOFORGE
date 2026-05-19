import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runReport } from "../../core/report/index.js";
import { runStage } from "./_run.js";

interface ReportOpts {
  since?: string;
  json?: boolean;
}

export function registerReport(program: Command): void {
  program
    .command("report")
    .description("Print current stage and verdict in human form")
    .option("--since <stage>", "show only stages on/after this one")
    .action(async (opts: ReportOpts) => {
      const globalJson = (program.opts() as { json?: boolean }).json === true;
      await runStage(
        () =>
          runReport(
            buildDeps(),
            opts.since !== undefined ? { since: opts.since } : {}
          ),
        (snap) => {
          if (globalJson) {
            process.stdout.write(JSON.stringify(snap) + "\n");
            return;
          }
          console.error(`current stage : ${snap.currentStage}`);
          console.error(`last verdict  : ${snap.lastVerdict ?? "(none)"}`);
          console.error(`team pattern  : ${snap.teamPattern ?? "(none)"}`);
          console.error(`open findings : ${snap.openFindings}`);
          console.error(
            `stages shown  : ${snap.stagesPresent.join(" → ") || "(none)"}`
          );
          console.error(`next          : ${snap.nextSuggested}`);
        }
      );
    });
}
