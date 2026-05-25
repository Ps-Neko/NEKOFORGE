import type { Command } from "commander";
import { runAuto } from "../../core/auto/index.js";
import { createClaudeWorkerAdapter } from "../../workers/adapters/claude.js";
import { createCodexRealAdapter } from "../../integrations/codex/real.js";
import { createCodexStubAdapter } from "../../integrations/codex/stub.js";
import { readGitDiff } from "../../utils/git.js";
import { gateStrictExitCode } from "../../core/gate/verdict.js";

interface AutoOpts { task?: string; adapter?: string; maxCost?: string; strict?: boolean; }

export function registerAuto(program: Command): void {
  program
    .command("auto <goal>")
    .description("14단계를 자동 진행하고 Human Gate 에서 정지 (AI 코드생성 + Codex 독립검수). 자동 apply 없음.")
    .option("--task <id>", "task id", "TASK-001")
    .option("--adapter <id>", "review adapter (codex | codex-stub)", "codex")
    .option("--max-cost <usd>", "AI 호출 비용 상한(USD)", "5")
    .option("--strict", "verdict 가 clean PASS 아니면 non-zero exit")
    .action(async (goal: string, opts: AutoOpts) => {
      const reviewAdapter = opts.adapter === "codex-stub"
        ? createCodexStubAdapter({ enabled: true })
        : createCodexRealAdapter();
      try {
        const r = await runAuto({
          goal,
          taskId: opts.task ?? "TASK-001",
          maxCostUsd: Number(opts.maxCost ?? "5"),
          workerAdapter: createClaudeWorkerAdapter(),
          reviewAdapter,
          captureDiff: () => readGitDiff(process.cwd()) ?? ""
        });
        console.error(`[verdict] ${r.verdict}`);
        console.error(`[rules]   ${r.triggeredRules.join(", ") || "(none)"}`);
        console.error(`[cost]    $${r.spentUsd.toFixed(2)}`);
        console.error(`[report]  ${r.reportPath} (workspace: ${r.workspace})`);
        console.error(`[next]    검토 후: harness apply --approved  (auto 는 apply 안 함)`);
        if (opts.strict) {
          const code = gateStrictExitCode(r.verdict);
          if (code !== 0) process.exit(code);
        }
      } catch (err) {
        const e = err as Error & { exitCode?: number };
        console.error(`[error] auto failed: ${e.message}`);
        process.exit(e.exitCode ?? 1);
      }
    });
}
