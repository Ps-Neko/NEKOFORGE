/**
 * harness dispatch — Phase WF.
 *
 * 1차 MVP: worker prompt 생성. 실제 LLM 자동 실행 미포함.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runDispatch, runDispatchAll } from "../../workers/dispatch.js";
import { runStage } from "./_run.js";
import type { WorkerRole } from "../../workers/index.js";

interface DispatchOpts {
  worker?: string;
  all?: boolean;
  profile?: string;
}

export function registerDispatch(program: Command): void {
  program
    .command("dispatch")
    .description(
      "Generate worker prompt(s). --worker <role> for single, --all for required workers"
    )
    .argument("<task-id>", "task id from .harness/TASKS.md")
    .option(
      "--worker <role>",
      "single worker role (implementation-worker, security-reviewer, ...)"
    )
    .option("--all", "dispatch all required workers by profile", false)
    .option(
      "--profile <name>",
      "minimal | standard | strict (override workers.json profile)"
    )
    .action(async (taskId: string, opts: DispatchOpts) => {
      if (opts.all) {
        await runStage(
          () =>
            runDispatchAll(
              {
                taskId,
                ...(opts.profile ? { profile: opts.profile as "minimal" | "standard" | "strict" } : {})
              },
              buildDeps()
            ),
          (r) => {
            console.error(`[ok] dispatched ${r.prompts.length} prompt(s).`);
            for (const p of r.prompts) {
              console.error(`     - ${p.role}: ${p.path}`);
            }
            console.error(`[ok] manifest: ${r.manifestPath}`);
            console.error(`[ok] handoff:  ${r.handoffPath}`);
            console.error(
              `[next] 각 prompt 의 결과를 \`harness worker-result import ${taskId} --worker <role> --file <result.md>\` 로 import`
            );
          }
        );
        return;
      }
      if (!opts.worker) {
        console.error("[error] --worker <role> required (or use --all)");
        process.exit(1);
      }
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
