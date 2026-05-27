import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, relative } from "node:path";
import type { StageDeps } from "../stage-runner.js";

export interface ContextResult {
  path: string;
}

export class ContextPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`context stage requires ${missing}`);
    this.name = "ContextPrecondError";
  }
}

const SKIP_DIRS = new Set([
  ".git",
  ".harness",
  ".claude",
  ".codex",
  ".cursor",
  "coverage",
  "dist",
  "node_modules"
]);

const MAX_FILES = 120;

interface ProjectSignals {
  files: string[];
  languages: Record<string, number>;
  packageScripts: string[];
  docs: string[];
  tests: string[];
  riskFiles: string[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function languageOf(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
      return "JavaScript";
    case "py":
      return "Python";
    case "go":
      return "Go";
    case "md":
      return "Markdown";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    default:
      return null;
  }
}

function isTestFile(path: string): boolean {
  return /(^|\/)(tests?|__tests__)\//.test(path) || /\.(test|spec)\.[^.]+$/.test(path);
}

function isDocFile(path: string): boolean {
  return /^README\.md$/i.test(path) || /^docs\/.+\.md$/i.test(path);
}

function isRiskFile(path: string): boolean {
  return (
    /^\.env($|\.)/.test(path) ||
    /^\.github\/workflows\//.test(path) ||
    /(^|\/)(auth|security|policy|secrets?)\//i.test(path) ||
    /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/.test(path) ||
    /\.(tf|rego)$/.test(path)
  );
}

async function walk(root: string, dir: string, acc: string[]): Promise<void> {
  if (acc.length >= MAX_FILES) return;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (acc.length >= MAX_FILES) return;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        await walk(root, join(dir, entry.name), acc);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    const abs = join(dir, entry.name);
    const rel = normalizePath(relative(root, abs));
    acc.push(rel);
  }
}

async function readPackageScripts(cwd: string): Promise<string[]> {
  try {
    const text = await readFile(join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
    return Object.entries(pkg.scripts ?? {}).map(([name, cmd]) => `${name}: ${cmd}`);
  } catch {
    return [];
  }
}

async function collectProjectSignals(cwd: string): Promise<ProjectSignals> {
  const files: string[] = [];
  try {
    const rootStat = await stat(cwd);
    if (!rootStat.isDirectory()) {
      return { files, languages: {}, packageScripts: [], docs: [], tests: [], riskFiles: [] };
    }
  } catch {
    return { files, languages: {}, packageScripts: [], docs: [], tests: [], riskFiles: [] };
  }

  await walk(cwd, cwd, files);
  const languages: Record<string, number> = {};
  for (const file of files) {
    const lang = languageOf(file);
    if (lang) languages[lang] = (languages[lang] ?? 0) + 1;
  }

  return {
    files,
    languages,
    packageScripts: await readPackageScripts(cwd),
    docs: files.filter(isDocFile).slice(0, 12),
    tests: files.filter(isTestFile).slice(0, 12),
    riskFiles: files.filter(isRiskFile).slice(0, 12)
  };
}

function renderList(items: string[], empty = "- none detected"): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : empty;
}

function renderContext(signals: ProjectSignals): string {
  const languages = Object.entries(signals.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count})`);

  return [
    "# Context",
    "",
    "> NEKOFORGE turns the existing source tree into reusable AI work context.",
    "> Fill the manual sections after reviewing the auto-detected project snapshot.",
    "",
    "## Auto-detected Project Snapshot",
    "",
    "### Source Map",
    renderList(signals.files.slice(0, 30), "- no source files detected"),
    "",
    "### Languages / File Types",
    renderList(languages, "- no known languages detected"),
    "",
    "### Package Scripts",
    renderList(signals.packageScripts, "- no package.json scripts detected"),
    "",
    "### Documentation",
    renderList(signals.docs),
    "",
    "### Tests",
    renderList(signals.tests),
    "",
    "### Risk-sensitive Files",
    renderList(signals.riskFiles),
    "",
    "## 1. Domain Terms",
    "-",
    "",
    "## 2. Existing Code Structure",
    "-",
    "",
    "## 3. Relevant Files for This Task",
    "-",
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

export async function runContext(deps: StageDeps): Promise<ContextResult> {
  if (!(await deps.artifact.exists("clarify.md"))) {
    throw new ContextPrecondError("clarify.md (run `harness ask`)");
  }
  const signals = await collectProjectSignals(deps.cwd);
  await deps.artifact.writeMarkdown("context.md", renderContext(signals));
  return { path: ".harness/context.md" };
}
