import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runPolicy } from "../../core/quality-policy/index.js";
import { runStage } from "./_run.js";

interface PolicyOpts {
  inherit?: string;
}

export function registerPolicy(program: Command): void {
  program
    .command("policy")
    .description("Select rules/hooks/context-policy (ECC-style quality policy)")
    .option("--inherit <profile>", "inherit from an existing quality-policy.md")
    .option("--from <plan-path>", "alternate plan path (reserved)")
    .action(async (opts: PolicyOpts) => {
      await runStage(
        () =>
          runPolicy(
            opts.inherit !== undefined ? { inheritFrom: opts.inherit } : {},
            buildDeps()
          ),
        (r) => {
          console.error(`[ok] ${r.policyPath} + rules/hooks/context-policy saved.`);
          console.error(`[next] harness team`);
        }
      );
    });
}
