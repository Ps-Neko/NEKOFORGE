/**
 * harness worker-result <subcommand> — Phase WF.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  importWorkerResult,
  listWorkerResults,
  showWorkerResult
} from "../../workers/result.js";
import { runStage } from "./_run.js";

export function registerWorkerResult(program: Command): void {
  const cmd = program
    .command("worker-result")
    .description("Worker result import/list/show (Phase WF)");

  cmd
    .command("import")
    .description("Import a worker result markdown (and optional json)")
    .argument("<task-id>", "task id")
    .requiredOption("--worker <role>", "worker role")
    .requiredOption("--file <path>", "result markdown file")
    .option("--json <path>", "optional result.json (otherwise minimal stub generated)")
    .action(
      async (
        taskId: string,
        opts: { worker: string; file: string; json?: string }
      ) => {
        await runStage(
          () =>
            importWorkerResult(
              {
                taskId,
                worker: opts.worker,
                file: opts.file,
                ...(opts.json ? { jsonFile: opts.json } : {})
              },
              buildDeps()
            ),
          (r) => {
            console.error(`[ok] result.md: ${r.resultMdPath}`);
            console.error(`[ok] result.json: ${r.resultJsonPath}`);
          }
        );
      }
    );

  cmd
    .command("list")
    .description("List worker results recorded for a task")
    .argument("<task-id>", "task id")
    .action(async (taskId: string) => {
      const rows = await listWorkerResults({ taskId }, buildDeps());
      if (rows.length === 0) {
        console.error(`(no worker results for ${taskId})`);
        return;
      }
      for (const r of rows) {
        console.error(
          `- ${r.worker} md=${r.hasMd ? "Y" : "N"} json=${r.hasJson ? "Y" : "N"}`
        );
      }
    });

  cmd
    .command("show")
    .description("Show one worker result")
    .argument("<task-id>", "task id")
    .requiredOption("--worker <role>", "worker role")
    .action(async (taskId: string, opts: { worker: string }) => {
      const r = await showWorkerResult(taskId, opts.worker, buildDeps());
      if (!r.md && !r.json) {
        console.error(`(no result for ${taskId} / ${opts.worker})`);
        process.exit(10);
      }
      if (r.json) {
        console.error(JSON.stringify(r.json, null, 2));
      }
      if (r.md) {
        console.error("---");
        console.error(r.md);
      }
    });
}
