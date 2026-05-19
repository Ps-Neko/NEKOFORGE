/**
 * harness dispatch — Phase WF.
 *
 * 1차 MVP: worker prompt 생성. 실제 LLM 자동 실행 미포함.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runDispatch } from "../../workers/dispatch.js";
import { runStage } from "./_run.js";
import type { WorkerRole } from "../../workers/index.js";

export function registerDispatch(program: Command): void {
  program
    .command("dispatch")
    .description("Generate a worker prompt under .harness/worker-runs/<task>/")
    .argument("<task-id>", "task id from .harness/TASKS.md")
    .requiredOption(
      "--worker <role>",
      "worker role (implementation-worker, security-reviewer, ...)"
    )
    .action(async (taskId: string, opts: { worker: string }) => {
      const worker = opts.worker as WorkerRole;
      await runStage(
        () => runDispatch({ taskId, worker }, buildDeps()),
        (r) => {
          console.error(`[ok] prompt saved: ${r.promptPath}`);
          console.error(
            `[next] 결과 작성 후 \`harness worker-result import ${taskId} --worker ${worker} --file <result.md>\``
          );
        }
      );
    });
}
