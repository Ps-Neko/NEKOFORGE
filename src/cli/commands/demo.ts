import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { runInit } from "../../core/init.js";
import { buildDeps, type StageDeps } from "../../core/stage-runner.js";
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
import { runWorkersInit } from "../../workers/index.js";
import { runDispatchAll } from "../../workers/dispatch.js";

interface DemoOpts {
  task?: string;
  clean?: boolean;
}

type DemoScenario = "safety" | "productivity";

const SAFETY_SPEC = {
  who: "solo developer evaluating AI-generated code",
  why: "see a deterministic gate block risky AI output before apply",
  problemIfMissing: "risky generated code can be applied because tests looked green",
  coreFeatures: "capture evidence, score quality, block unsafe diffs, require human gate",
  notDoing: "no commit, push, deploy, or real project mutation",
  successCriteria: "secret fallback diff produces BLOCK with REPORT.md and decision.json",
  failureCriteria: "demo produces PASS or mutates the caller project"
};

const SAFETY_CONTRACT = {
  user: "solo developer",
  problem: "AI generated an auth/session change with a hardcoded fallback secret",
  coreValue: "NEKOFORGE blocks the diff before explicit apply"
};

const PRODUCTIVITY_SPEC = {
  who: "developer using AI inside an existing TypeScript service",
  why: "turn current source, tests, and conventions into a reusable AI work packet",
  problemIfMissing: "AI receives a vague request and edits the wrong files or misses tests",
  coreFeatures: "source map, task packet, worker prompts, test plan, verification path",
  notDoing: "no code generation, commit, push, deploy, or real project mutation",
  successCriteria: "demo produces context.md, task packet, worker prompts, and handoff",
  failureCriteria: "demo only shows a blocking gate and does not show AI work context"
};

const PRODUCTIVITY_CONTRACT = {
  user: "developer using AI on an existing codebase",
  problem: "AI needs project-specific context before editing authentication behavior",
  coreValue: "NEKOFORGE packages source context into actionable AI work units"
};

const SAFETY_DIFF = [
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

const PRODUCTIVITY_CONTEXT = [
  "# Context",
  "",
  "> Auto-detected source context from the productivity demo project.",
  "",
  "## Auto-detected Project Snapshot",
  "",
  "### Source Map",
  "- package.json: scripts and project commands",
  "- src/auth/login.ts: existing login behavior",
  "- src/auth/session.ts: session creation helper",
  "- tests/auth/login.test.ts: current auth tests",
  "",
  "### Languages / File Types",
  "- TypeScript (2)",
  "- Markdown (1)",
  "- JSON (1)",
  "",
  "### Package Scripts",
  "- test: node --test tests/**/*.test.ts",
  "- typecheck: tsc --noEmit",
  "",
  "### Documentation",
  "- README.md",
  "",
  "### Tests",
  "- tests/auth/login.test.ts",
  "",
  "### Risk-sensitive Files",
  "- src/auth/login.ts",
  "- src/auth/session.ts",
  "",
  "## 1. Domain Terms",
  "- login attempt, lockout window, session token",
  "",
  "## 2. Existing Code Structure",
  "- auth code lives under src/auth",
  "- tests mirror auth behavior under tests/auth",
  "",
  "## 3. Relevant Files for This Task",
  "- src/auth/login.ts",
  "- tests/auth/login.test.ts",
  "",
  "## 4. External Dependencies",
  "- no external service required for the demo",
  "",
  "## 5. Security Constraints",
  "- do not bypass authentication",
  "- do not introduce hardcoded secrets",
  "",
  "## 6. Test Constraints",
  "- keep existing login tests",
  "- add a lockout edge case test before apply",
  ""
].join("\n");

function parseScenario(raw: string | undefined): DemoScenario {
  const scenario = raw ?? "safety";
  if (scenario === "safety" || scenario === "productivity") return scenario;
  throw new Error(`unknown demo scenario: ${scenario}. Expected safety or productivity`);
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function seedProductivityProject(workspace: string): Promise<void> {
  await mkdir(join(workspace, "src", "auth"), { recursive: true });
  await mkdir(join(workspace, "tests", "auth"), { recursive: true });
  await writeJsonFile(join(workspace, "package.json"), {
    name: "nekoforge-productivity-demo",
    type: "module",
    scripts: {
      test: "node --test tests/**/*.test.ts",
      typecheck: "tsc --noEmit"
    }
  });
  await writeFile(
    join(workspace, "README.md"),
    "# Demo Service\n\nExisting auth service used by harness demo productivity.\n",
    "utf8"
  );
  await writeFile(
    join(workspace, "src", "auth", "login.ts"),
    [
      "export interface LoginInput { email: string; password: string }",
      "",
      "export function canLogin(input: LoginInput): boolean {",
      "  return input.email.length > 0 && input.password.length >= 8;",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(workspace, "src", "auth", "session.ts"),
    [
      "export function createSession(userId: string): string {",
      "  return `session:${userId}`;",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(workspace, "tests", "auth", "login.test.ts"),
    [
      "import { strict as assert } from 'node:assert';",
      "import { test } from 'node:test';",
      "import { canLogin } from '../../src/auth/login.js';",
      "",
      "test('valid password can log in', () => {",
      "  assert.equal(canLogin({ email: 'a@example.com', password: 'longpass' }), true);",
      "});",
      ""
    ].join("\n"),
    "utf8"
  );
}

async function runBasePlanningFlow(
  workspace: string,
  deps: StageDeps,
  taskId: string,
  spec: Record<string, string>,
  contract: Record<string, string>
): Promise<void> {
  const specAnswers = join(workspace, "demo-spec-answers.json");
  await writeJsonFile(specAnswers, spec);
  await runSpec({ answersFile: specAnswers }, deps);

  await runPlan({}, deps);
  await runDesign({ pattern: "Producer-Reviewer" }, deps);
  await runPolicy({}, deps);
  await runTeam(deps);

  const contractAnswers = join(workspace, "demo-contract-answers.json");
  await writeJsonFile(contractAnswers, contract);
  await runQualityContract(
    { taskId, template: "backend-api", answersFile: contractAnswers },
    deps
  );
}

async function runSafetyDemo(taskId: string, clean: boolean): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), "nekoforge-demo-"));
  try {
    await runInit({ cwd: workspace });
    const deps = buildDeps(workspace);

    await runIntake({ goal: "Demo: block AI-added fallback secret" }, deps);
    await runClarify(deps);
    await runContext(deps);
    await runBasePlanningFlow(workspace, deps, taskId, SAFETY_SPEC, SAFETY_CONTRACT);

    await deps.artifact.writeMarkdown("last-diff.patch", SAFETY_DIFF + "\n");
    await deps.artifact.writeMarkdown(`pending/${taskId}.patch`, SAFETY_DIFF + "\n");
    await deps.artifact.writeMarkdown(
      "worklog.md",
      [
        `## ${taskId} - ${isoNow(systemClock)}`,
        `- demo diff hash: ${canonicalHash(SAFETY_DIFF)}`,
        "- demo scenario: AI-added fallback secret",
        ""
      ].join("\n")
    );

    await runReview(
      { adapters: [createCodexStubAdapter({ enabled: true, forceStatus: "passed" })] },
      deps
    );
    const result = await runGate({ taskId, testStatus: "passed" }, deps);

    console.error(`[demo]    workspace=${workspace}`);
    console.error(`[scenario] safety: AI diff adds process.env.JWT_SECRET fallback`);
    console.error(`[verdict] ${result.verdict}`);
    console.error(`[rules]   ${result.triggeredRules.join(", ") || "(none)"}`);
    console.error(`[report]  ${join(workspace, result.reportPath)}`);
    console.error(`[decision] ${join(workspace, result.decisionPath)}`);
    console.error(`[next]    open REPORT.md; demo never applies changes`);

    if (clean) {
      await rm(workspace, { recursive: true, force: true });
      console.error(`[clean]   removed demo workspace`);
    }
  } catch (err) {
    await cleanupAndExit(err, workspace, clean);
  }
}

async function runProductivityDemo(taskId: string, clean: boolean): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), "nekoforge-productivity-demo-"));
  try {
    await seedProductivityProject(workspace);
    await runInit({ cwd: workspace });
    const deps = buildDeps(workspace);

    await runIntake(
      { goal: "Add lockout after five failed login attempts without breaking existing auth tests" },
      deps
    );
    await runClarify(deps);
    await runContext(deps);
    await deps.artifact.writeMarkdown("context.md", PRODUCTIVITY_CONTEXT);
    await runBasePlanningFlow(
      workspace,
      deps,
      taskId,
      PRODUCTIVITY_SPEC,
      PRODUCTIVITY_CONTRACT
    );

    await runWorkersInit({ profile: "standard", force: true }, deps);
    const dispatch = await runDispatchAll({ taskId, profile: "standard" }, deps);
    const packetRel = `task-packets/${taskId}.md`;
    await deps.artifact.writeMarkdown(
      packetRel,
      [
        `# AI Work Packet - ${taskId}`,
        "",
        "## Goal",
        "Add lockout after five failed login attempts without breaking existing auth behavior.",
        "",
        "## Existing Source Context",
        "- Auth code lives in `src/auth/`.",
        "- Current login behavior is covered by `tests/auth/login.test.ts`.",
        "- Available commands: `npm test`, `npm run typecheck`.",
        "",
        "## Suggested AI Work",
        "- Update `src/auth/login.ts` with a small lockout policy.",
        "- Add a focused edge-case test in `tests/auth/login.test.ts`.",
        "- Keep session creation unchanged.",
        "",
        "## Worker Prompts",
        ...dispatch.prompts.map((p) => `- ${p.role}: ${p.path}`),
        "",
        "## Safety Layer",
        "- Run review and gate before apply.",
        "- Do not commit, push, deploy, or run `harness apply` from a worker.",
        ""
      ].join("\n")
    );

    console.error(`[demo]    workspace=${workspace}`);
    console.error(`[scenario] productivity: source -> context -> task packet -> worker prompts`);
    console.error(`[context] .harness/context.md`);
    console.error(`[packet]  .harness/${packetRel}`);
    console.error(`[prompts] ${dispatch.prompts.length} worker prompt(s)`);
    console.error(`[handoff] ${dispatch.handoffPath}`);
    console.error(`[next]    open the task packet; no code was applied`);

    if (clean) {
      await rm(workspace, { recursive: true, force: true });
      console.error(`[clean]   removed demo workspace`);
    }
  } catch (err) {
    await cleanupAndExit(err, workspace, clean);
  }
}

async function cleanupAndExit(err: unknown, workspace: string, clean: boolean): Promise<never> {
  const e = err as Error & { exitCode?: number };
  console.error(`[error] demo failed: ${e.message}`);
  if (clean) {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
  process.exit(e.exitCode ?? 1);
}

export function registerDemo(program: Command): void {
  program
    .command("demo")
    .description("Run an isolated NEKOFORGE demo (safety or productivity).")
    .argument("[scenario]", "safety | productivity", "safety")
    .option("--task <id>", "task id", "TASK-001")
    .option("--clean", "remove the temporary demo workspace after printing the result", false)
    .action(async (scenarioRaw: string | undefined, opts: DemoOpts) => {
      const scenario = parseScenario(scenarioRaw);
      const taskId = opts.task ?? "TASK-001";
      if (scenario === "productivity") {
        await runProductivityDemo(taskId, opts.clean === true);
      } else {
        await runSafetyDemo(taskId, opts.clean === true);
      }
    });
}
