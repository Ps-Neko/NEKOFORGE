import type { Command } from "commander";
import { buildDeps, resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runApply } from "../../core/apply/index.js";
import { runMemoryAdd } from "../../core/memory/index.js";
import { AutoApplyBlockedError } from "../../rules/auto-apply-block.js";
import { appendAuditEvent } from "../../utils/audit.js";

interface ApplyOpts {
  approved?: boolean;
  dryRun?: boolean;
}

export function registerApply(program: Command): void {
  program
    .command("apply")
    .description(
      "Apply changes only if verdict + human approval ok (requires --approved)"
    )
    .requiredOption("--approved", "explicit approval flag (no alias)")
    .option("--dry-run", "run blocking algorithm without applying")
    .action(async (opts: ApplyOpts) => {
      const deps = buildDeps();
      try {
        const result = await runApply(
          {
            approved: opts.approved === true,
            dryRun: opts.dryRun === true
          },
          deps
        );
        console.error(`[ok] ${result.reason}`);
        console.error(`[log] ${result.applyLogPath}`);
        // Codex re-review #3 (Medium) — apply 통과 시 memory 자동 적재.
        if (result.applied) {
          await runMemoryAdd(
            {
              kind: "milestone_passed",
              summary: `apply passed (verdict via decision.json)`,
              relatedTaskId: "apply-auto",
              sourceVerdict: "apply_ok"
            },
            deps
          ).catch(() => {
            // memory 적재 실패가 apply 자체 결과를 바꾸지 않는다.
          });
        }
        if (!result.applied) {
          console.error(`[info] dry-run only; no apply happened`);
        } else {
          console.error(`[next] harness report`);
        }
      } catch (err) {
        const cwd = resolveWorkspaceCwd();
        if (err instanceof AutoApplyBlockedError) {
          await appendAuditEvent(
            {
              type: "apply_refused",
              verdict: err.verdict,
              reason: "auto-apply-block"
            },
            cwd
          );
          console.error(`[refuse] verdict=${err.verdict}`);
          console.error(`[exit]   ${err.exitCode}`);
          process.exit(err.exitCode);
        }
        const e = err as Error & { exitCode?: number };
        await appendAuditEvent(
          {
            type: "apply_refused",
            reason: e.message,
            exitCode: e.exitCode ?? 1
          },
          cwd
        );
        console.error(`[refuse] ${e.message}`);
        process.exit(e.exitCode ?? 1);
      }
    });
}
