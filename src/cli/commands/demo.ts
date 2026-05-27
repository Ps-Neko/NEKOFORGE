import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { runInit } from "../../core/init.js";
import { buildDeps } from "../../core/stage-runner.js";
import { runIntake } from "../../core/intake/index.js";
import { runClarify } from "../../core/clarify/index.js";
import { runContext } from "../../core/context/index.js";
import { runSpec } from "../../core/spec/index.js";
import { runPlan } from "../../core/plan/index.js";
import { runDesign } from "../../core/harness-design/index.js";
import { runPolicy } from "../../core/quality-policy/index.js";
import { runTeam } from "../../core/team/index.js";
import { runQualityContract } from "../../core/quality-contract/index.js";
import { runReview } from "../../core/review/index.js";
import { runGate } from "../../core/gate/index.js";
import { createCodexStubAdapter } from "../../integrations/codex/stub.js";
import { isoNow, systemClock } from "../../utils/time.js";
import { canonicalHash } from "../../utils/integrity.js";

interface DemoOpts {
  task?: string;
  clean?: boolean;
}

const DEMO_SPEC = {
  who: "solo developer evaluating AI-generated code",
  why: "see a deterministic gate block risky AI output before apply",
  problemIfMissing: "risky generated code can be applied because tests looked green",
  coreFeatures: "capture evidence, score quality, block unsafe diffs, require human gate",
  notDoing: "no commit, push, deploy, or real project mutation",
  successCriteria: "secret fallback diff produces BLOCK with REPORT.md and decision.json",
  failureCriteria: "demo produces PASS or mutates the caller project"
};

const DEMO_CONTRACT = {
  user: "solo developer",
  problem: "AI generated an auth/session change with a hardcoded fallback secret",
  coreValue: "NEKOFORGE blocks the diff before explicit apply"
};

const DEMO_DIFF = [
  "diff --git a/src/auth/session.ts b/src/auth/session.ts",
  "new file mode 100644",
  "index 0000000..1111111",
  "--- /dev/null",
  "+++ b/src/auth/session.ts",
  "@@ -0,0 +1,4 @@",
  "+export function sessionSecret(): string {",
  "+  return process.env.JWT_SECRET || \"demo-secret-key-1234567890\";",
  "+}",
  "+"
].join("\n");

export function registerDemo(program: Command): void {
  program
    .command("demo")
    .description("Run a 3-minute isolated demo that shows NEKOFORGE blocking a risky AI diff.")
    .option("--task <id>", "task id", "TASK-001")
    .option("--clean", "remove the temporary demo workspace after printing the result", false)
    .action(async (opts: DemoOpts) => {
      const taskId = opts.task ?? "TASK-001";
      const workspace = await mkdtemp(join(tmpdir(), "nekoforge-demo-"));
      try {
        await runInit({ cwd: workspace });
        const deps = buildDeps(workspace);

        await runIntake({ goal: "Demo: block AI-added fallback secret" }, deps);
        await runClarify(deps);
        await runContext(deps);

        const specAnswers = join(workspace, "demo-spec-answers.json");
        await writeFile(specAnswers, JSON.stringify(DEMO_SPEC), "utf8");
        await runSpec({ answersFile: specAnswers }, deps);

        await runPlan({}, deps);
        await runDesign({ pattern: "Producer-Reviewer" }, deps);
        await runPolicy({}, deps);
        await runTeam(deps);

        const contractAnswers = join(workspace, "demo-contract-answers.json");
        await writeFile(contractAnswers, JSON.stringify(DEMO_CONTRACT), "utf8");
        await runQualityContract(
          { taskId, template: "backend-api", answersFile: contractAnswers },
          deps
        );

        await deps.artifact.writeMarkdown("last-diff.patch", DEMO_DIFF + "\n");
        await deps.artifact.writeMarkdown(`pending/${taskId}.patch`, DEMO_DIFF + "\n");
        await deps.artifact.writeMarkdown(
          "worklog.md",
          [
            `## ${taskId} - ${isoNow(systemClock)}`,
            `- demo diff hash: ${canonicalHash(DEMO_DIFF)}`,
            "- demo scenario: AI-added fallback secret",
            ""
          ].join("\n")
        );

        await runReview(
          { adapters: [createCodexStubAdapter({ enabled: true, forceStatus: "passed" })] },
          deps
        );
        const result = await runGate({ taskId, testStatus: "passed" }, deps);

        const reportPath = join(workspace, result.reportPath);
        const decisionPath = join(workspace, result.decisionPath);
        console.error(`[demo]    workspace=${workspace}`);
        console.error(`[scenario] AI diff adds process.env.JWT_SECRET fallback`);
        console.error(`[verdict] ${result.verdict}`);
        console.error(`[rules]   ${result.triggeredRules.join(", ") || "(none)"}`);
        console.error(`[report]  ${reportPath}`);
        console.error(`[decision] ${decisionPath}`);
        console.error(`[next]    open REPORT.md; demo never applies changes`);

        if (opts.clean === true) {
          await rm(workspace, { recursive: true, force: true });
          console.error(`[clean]   removed demo workspace`);
        }
      } catch (err) {
        const e = err as Error & { exitCode?: number };
        console.error(`[error] demo failed: ${e.message}`);
        if (opts.clean === true) {
          await rm(workspace, { recursive: true, force: true }).catch(() => {});
        }
        process.exit(e.exitCode ?? 1);
      }
    });
}
