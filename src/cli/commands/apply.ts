import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runApply } from "../../core/apply/index.js";
import { AutoApplyBlockedError } from "../../rules/auto-apply-block.js";

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
      try {
        const result = await runApply(
          {
            approved: opts.approved === true,
            dryRun: opts.dryRun === true
          },
          buildDeps()
        );
        console.error(`[ok] ${result.reason}`);
        console.error(`[log] ${result.applyLogPath}`);
        if (!result.applied) {
          console.error(`[info] dry-run only; no apply happened`);
        } else {
          console.error(`[next] harness report`);
        }
      } catch (err) {
        if (err instanceof AutoApplyBlockedError) {
          console.error(`[refuse] verdict=${err.verdict}`);
          console.error(`[exit]   ${err.exitCode}`);
          process.exit(err.exitCode);
        }
        const e = err as Error & { exitCode?: number };
        console.error(`[refuse] ${e.message}`);
        process.exit(e.exitCode ?? 1);
      }
    });
}
