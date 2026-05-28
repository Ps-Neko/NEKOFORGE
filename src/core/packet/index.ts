import type { StageDeps } from "../stage-runner.js";

export interface PacketInput {
  taskId: string;
  workerPrompts?: Array<{ role: string; path: string }>;
}

export interface PacketResult {
  packetPath: string;
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
  const packetRel = `task-packets/${input.taskId}.md`;

  const lines = [
    `# AI Work Packet - ${input.taskId}`,
    "",
    "## Goal",
    "",
    extractGoal(intake),
    "",
    "## Task Row",
    "",
    extractTaskRow(tasks, input.taskId),
    "",
    "## Files To Inspect First",
    "",
    ...renderList(relevant, "no task-specific files detected; review context Source Map first"),
    "",
    "## Existing Tests",
    "",
    ...renderList(tests, "no tests detected yet"),
    "",
    "## Useful Commands",
    "",
    ...renderList(scripts, "no package scripts detected"),
    "",
    "## Risk-sensitive Files",
    "",
    ...renderList(riskFiles, "none detected"),
    "",
    ...snippet("SPEC Snapshot", spec),
    ...snippet("PLAN Snapshot", plan),
    ...snippet("Quality Contract", contract),
    "## Worker Prompts",
    "",
    ...(input.workerPrompts && input.workerPrompts.length > 0
      ? input.workerPrompts.map((p) => `- ${p.role}: ${p.path}`)
      : [
          "- Run `harness workers init --profile standard` if workers are not configured.",
          `- Run \`harness dispatch ${input.taskId} --all\` to create role-specific prompts.`
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
    `harness dispatch ${input.taskId} --all`,
    "harness review",
    `harness gate --task ${input.taskId}`,
    "```",
    ""
  ];

  await deps.artifact.writeMarkdown(packetRel, lines.join("\n"));
  return { packetPath: `.harness/${packetRel}`, taskId: input.taskId };
}
