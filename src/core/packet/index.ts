import type { StageDeps } from "../stage-runner.js";

export type PacketTool = "generic" | "codex" | "claude" | "cursor" | "all";

export interface PacketInput {
  taskId: string;
  tool?: PacketTool;
  workerPrompts?: Array<{ role: string; path: string }>;
}

export interface PacketResult {
  packetPath: string;
  packetPaths: string[];
  taskId: string;
}

export class PacketPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`packet stage requires ${missing}`);
    this.name = "PacketPrecondError";
  }
}

const MAX_SNIPPET = 2500;

function extractGoal(intake: string | null): string {
  if (!intake) return "(no intake goal found)";
  const lines = intake.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "- goal: |");
  if (start < 0) return "(no intake goal found)";
  const goalLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    goalLines.push(line.slice(2));
  }
  return goalLines.join("\n").trim() || "(no intake goal found)";
}

function extractSectionList(text: string | null, heading: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3}\s/.test(line)) break;
    section.push(line);
  }
  return section
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.toLowerCase().startsWith("- no "))
    .slice(0, 12);
}

function extractTaskRow(tasks: string | null, taskId: string): string {
  if (!tasks) return "(TASKS.md not found yet)";
  const row = tasks
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`| ${taskId} |`));
  return row?.trim() ?? `(task ${taskId} not found in TASKS.md yet)`;
}

function snippet(label: string, text: string | null): string[] {
  if (!text) return [`## ${label}`, "", "(not generated yet)", ""];
  const body = text.trim().slice(0, MAX_SNIPPET);
  return [`## ${label}`, "", body, ""];
}

function renderList(items: string[], empty: string): string[] {
  return items.length > 0 ? items : [`- ${empty}`];
}

interface PacketContext {
  taskId: string;
  goal: string;
  taskRow: string;
  relevant: string[];
  tests: string[];
  scripts: string[];
  riskFiles: string[];
  spec: string | null;
  plan: string | null;
  contract: string | null;
  workerPrompts?: Array<{ role: string; path: string }>;
}

function renderBasePacket(ctx: PacketContext): string {
  return [
    `# AI Work Packet - ${ctx.taskId}`,
    "",
    "## Goal",
    "",
    ctx.goal,
    "",
    "## Task Row",
    "",
    ctx.taskRow,
    "",
    "## Files To Inspect First",
    "",
    ...renderList(ctx.relevant, "no task-specific files detected; review context Source Map first"),
    "",
    "## Existing Tests",
    "",
    ...renderList(ctx.tests, "no tests detected yet"),
    "",
    "## Useful Commands",
    "",
    ...renderList(ctx.scripts, "no package scripts detected"),
    "",
    "## Risk-sensitive Files",
    "",
    ...renderList(ctx.riskFiles, "none detected"),
    "",
    ...snippet("SPEC Snapshot", ctx.spec),
    ...snippet("PLAN Snapshot", ctx.plan),
    ...snippet("Quality Contract", ctx.contract),
    "## Worker Prompts",
    "",
    ...(ctx.workerPrompts && ctx.workerPrompts.length > 0
      ? ctx.workerPrompts.map((p) => `- ${p.role}: ${p.path}`)
      : [
          "- Run `harness workers init --profile standard` if workers are not configured.",
          `- Run \`harness dispatch ${ctx.taskId} --all\` to create role-specific prompts.`
        ]),
    "",
    "## Boundaries",
    "",
    "- Do not commit, push, deploy, or run `harness apply` from an AI worker.",
    "- Do not edit `.harness/decision.json` or `.harness/audit.jsonl` manually.",
    "- Preserve or add focused tests for changed behavior.",
    "- Run `harness review` and `harness gate` before apply.",
    "",
    "## Next Commands",
    "",
    "```bash",
    `harness dispatch ${ctx.taskId} --all`,
    "harness review",
    `harness gate --task ${ctx.taskId}`,
    "```",
    ""
  ].join("\n");
}

function renderToolPrompt(tool: Exclude<PacketTool, "generic" | "all">, ctx: PacketContext): string {
  const title: Record<Exclude<PacketTool, "generic" | "all">, string> = {
    codex: "Codex Work Packet",
    claude: "Claude Code Work Packet",
    cursor: "Cursor Work Packet"
  };
  const toolInstruction: Record<Exclude<PacketTool, "generic" | "all">, string[]> = {
    codex: [
      "Use this packet as the task brief for Codex.",
      "Inspect the listed files first, make a minimal code change, and report the tests you ran."
    ],
    claude: [
      "Use this packet as the task brief for Claude Code.",
      "Edit the working tree directly only for the requested task, and keep `.harness/` untouched."
    ],
    cursor: [
      "Use this packet in Cursor chat/agent.",
      "Open the listed files before editing, keep the change small, and preserve the existing style."
    ]
  };

  return [
    `# ${title[tool]} - ${ctx.taskId}`,
    "",
    "## Paste This To The AI Tool",
    "",
    ...toolInstruction[tool],
    "",
    "```text",
    `Task: ${ctx.goal}`,
    "",
    "Inspect these files first:",
    ...renderList(ctx.relevant, "use the Context Source Map to find relevant files"),
    "",
    "Use these tests or commands:",
    ...renderList(ctx.scripts.length > 0 ? ctx.scripts : ctx.tests, "identify the project's test command before editing"),
    "",
    "Boundaries:",
    "- Do not commit, push, deploy, or run harness apply.",
    "- Do not edit .harness/decision.json or .harness/audit.jsonl.",
    "- Preserve or add focused tests for changed behavior.",
    "- Summarize changed files and tests run when finished.",
    "```",
    "",
    renderBasePacket(ctx)
  ].join("\n");
}

function toolsToWrite(tool: PacketTool): Array<"generic" | "codex" | "claude" | "cursor"> {
  if (tool === "all") return ["generic", "codex", "claude", "cursor"];
  return [tool];
}

function packetRelativePath(taskId: string, tool: "generic" | "codex" | "claude" | "cursor"): string {
  const suffix = tool === "generic" ? "" : `.${tool}`;
  return `task-packets/${taskId}${suffix}.md`;
}

export async function runPacket(
  input: PacketInput,
  deps: StageDeps
): Promise<PacketResult> {
  if (!(await deps.artifact.exists("context.md"))) {
    throw new PacketPrecondError("context.md (run `harness context`)");
  }

  const intake = await deps.artifact.readMarkdown("intake.md");
  const context = await deps.artifact.readMarkdown("context.md");
  const spec = await deps.artifact.readMarkdown("SPEC.md");
  const plan = await deps.artifact.readMarkdown("PLAN.md");
  const tasks = await deps.artifact.readMarkdown("TASKS.md");
  const contract = await deps.artifact.readMarkdown("quality-contract.json");

  const relevant = extractSectionList(context, "### Suggested Relevant Files");
  const tests = extractSectionList(context, "### Tests");
  const scripts = extractSectionList(context, "### Package Scripts");
  const riskFiles = extractSectionList(context, "### Risk-sensitive Files");
  const packetContext: PacketContext = {
    taskId: input.taskId,
    goal: extractGoal(intake),
    taskRow: extractTaskRow(tasks, input.taskId),
    relevant,
    tests,
    scripts,
    riskFiles,
    spec,
    plan,
    contract,
    workerPrompts: input.workerPrompts
  };

  const generated: string[] = [];
  for (const tool of toolsToWrite(input.tool ?? "generic")) {
    const packetRel = packetRelativePath(input.taskId, tool);
    const body =
      tool === "generic" ? renderBasePacket(packetContext) : renderToolPrompt(tool, packetContext);
    await deps.artifact.writeMarkdown(packetRel, body);
    generated.push(`.harness/${packetRel}`);
  }

  return { packetPath: generated[0]!, packetPaths: generated, taskId: input.taskId };
}
