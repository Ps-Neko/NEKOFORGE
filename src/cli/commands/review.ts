import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runReview } from "../../core/review/index.js";
import type { ReviewAdapter } from "../../integrations/review-adapter.js";
import { createCodexStubAdapter } from "../../integrations/codex/stub.js";
import { createCodexRealAdapter } from "../../integrations/codex/real.js";
import { createClaudeReviewAdapter } from "../../integrations/claude/review.js";
import { runStage } from "./_run.js";

interface ReviewOpts {
  adapter?: string;
  skipSelf?: boolean;
}

function selectAdapters(sel: string): ReviewAdapter[] {
  switch (sel) {
    case "none":
      return [];
    case "codex-stub":
      return [createCodexStubAdapter({ enabled: true })];
    case "codex":
      return [createCodexRealAdapter()];
    case "claude":
      return [createClaudeReviewAdapter()];
    case "all":
      return [createCodexRealAdapter(), createClaudeReviewAdapter()];
    default:
      throw new Error(`unknown adapter: ${sel}`);
  }
}

export function registerReview(program: Command): void {
  program
    .command("review")
    .description("Run self-review and codex-review adapters")
    .option(
      "--adapter <id>",
      "review adapter (all | none | codex-stub | codex | claude)",
      "none"
    )
    .option("--skip-self", "skip self-review (debug only)")
    .action(async (opts: ReviewOpts) => {
      const adapters = selectAdapters(opts.adapter ?? "none");
      await runStage(
        () =>
          runReview(
            { adapters, skipSelf: opts.skipSelf === true },
            buildDeps()
          ),
        (r) => {
          console.error(
            `[ok] review done: status=${r.adapterStatus}, adapters=${r.adapterCount}`
          );
          if (r.adapterCount === 0) {
            console.error(
              `[warn] external adapters=0; independent review not run. Use --adapter codex, --adapter claude, or --adapter all for external review.`
            );
          }
          console.error(`[next] harness gate`);
        }
      );
    });
}
