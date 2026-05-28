import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import { runSourceMap, type SourceMap } from "../source-map/index.js";

export interface ContextInput {
  fromFile?: string;
}

export interface ContextResult {
  path: string;
  sourceMapPath: string;
}

export class ContextPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`context stage requires ${missing}`);
    this.name = "ContextPrecondError";
  }
}

export class ContextInputError extends Error {
  readonly exitCode = 1;
  constructor(message: string) {
    super(message);
    this.name = "ContextInputError";
  }
}

const MAX_USER_CONTEXT_CHARS = 6000;

async function readUserContext(cwd: string, fromFile?: string): Promise<string | undefined> {
  if (!fromFile) return undefined;
  try {
    const text = await readFile(resolve(cwd, fromFile), "utf8");
    return text.trim().slice(0, MAX_USER_CONTEXT_CHARS);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ContextInputError(`context input file not found: ${fromFile}`);
    }
    throw err;
  }
}

async function readTaskHints(deps: StageDeps, userContext?: string): Promise<string> {
  const intake = (await deps.artifact.readMarkdown("intake.md")) ?? "";
  const clarify = (await deps.artifact.readMarkdown("clarify.md")) ?? "";
  return [intake, clarify, userContext ?? ""].join("\n");
}

function renderList(items: string[], empty = "- none detected"): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : empty;
}

function renderContext(sm: SourceMap): string {
  const languages = Object.entries(sm.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count})`);

  return [
    "# Context",
    "",
    "> NEKOFORGE turns the existing source tree into reusable AI work context.",
    "> Fill the manual sections after reviewing the auto-detected project snapshot.",
    "> Machine-readable snapshot: `.harness/source-map.json` (consumed by other stages).",
    "",
    "## Auto-detected Project Snapshot",
    "",
    "### Source Map",
    renderList(sm.files.slice(0, 30), "- no source files detected"),
    "",
    "### Suggested Relevant Files",
    renderList(sm.relevantFiles, "- no task-specific file names detected yet"),
    "",
    "### Languages / File Types",
    renderList(languages, "- no known languages detected"),
    "",
    "### Package Scripts",
    renderList(sm.packageScripts, "- no package.json scripts detected"),
    "",
    "### Documentation",
    renderList(sm.docs),
    "",
    "### Tests",
    renderList(sm.tests),
    "",
    "### Risk-sensitive Files",
    renderList(sm.riskFiles),
    "",
    ...(sm.userContext
      ? [
          "## User-provided Context",
          "",
          sm.userContext,
          ""
        ]
      : []),
    "## 1. Domain Terms",
    "-",
    "",
    "## 2. Existing Code Structure",
    "-",
    "",
    "## 3. Relevant Files for This Task",
    renderList(sm.relevantFiles, "-"),
    "",
    "## 4. External Dependencies",
    "-",
    "",
    "## 5. Security Constraints",
    "-",
    "",
    "## 6. Test Constraints",
    "-",
    ""
  ].join("\n");
}

export async function runContext(
  deps: StageDeps,
  input: ContextInput = {}
): Promise<ContextResult> {
  if (!(await deps.artifact.exists("clarify.md"))) {
    throw new ContextPrecondError("clarify.md (run `harness ask`)");
  }
  const userContext = await readUserContext(deps.cwd, input.fromFile);
  const hints = await readTaskHints(deps, userContext);
  const sourceMap = await runSourceMap(deps, {
    hints,
    ...(userContext !== undefined ? { userContext } : {})
  });
  await deps.artifact.writeMarkdown("context.md", renderContext(sourceMap.sourceMap));
  return { path: ".harness/context.md", sourceMapPath: sourceMap.jsonPath };
}
