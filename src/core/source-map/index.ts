/**
 * Source Map — 프로젝트 스냅샷 1급 artifact.
 *
 * `.harness/source-map.json` (machine-readable, schema 검증) 과
 * `.harness/source-map.md` (사람용 요약) 을 생성한다. context/packet/dispatch 등
 * 다른 stage 는 본 artifact 를 파일로 읽어 재사용한다(직접 import 금지 — leaf).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, relative } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import { isoNow } from "../../utils/time.js";
import { ENGINE_VERSION } from "../../version.js";

export interface SourceMap {
  schemaVersion: "0.5";
  engineVersion: string;
  generatedAt: string;
  files: string[];
  languages: Record<string, number>;
  packageScripts: string[];
  docs: string[];
  tests: string[];
  riskFiles: string[];
  relevantFiles: string[];
  userContext?: string;
  limits: {
    maxFiles: number;
    scanned: number;
    truncated: boolean;
  };
}

export interface SourceMapInput {
  hints?: string;
  userContext?: string;
}

export interface SourceMapResult {
  sourceMap: SourceMap;
  jsonPath: string;
  markdownPath: string;
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

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "into",
  "after",
  "before",
  "without",
  "existing",
  "current",
  "project",
  "task",
  "feature",
  "change",
  "changes",
  "add",
  "fix",
  "make",
  "use",
  "using"
]);

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

function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]{2,}/g);
  if (!tokens) return [];
  return [...new Set(tokens.filter((t) => !STOP_WORDS.has(t)))];
}

function scoreRelevantFile(file: string, tokens: string[]): number {
  const haystack = file.toLowerCase().replace(/[._/-]+/g, " ");
  let score = 0;
  for (const token of tokens) {
    const normalized = token.replace(/[-_]+/g, " ");
    if (haystack.includes(normalized)) score += 3;
    else if (haystack.includes(token)) score += 2;
  }
  if (score > 0 && isTestFile(file)) score += 1;
  if (score > 0 && isRiskFile(file)) score += 1;
  return score;
}

function rankRelevantFiles(files: string[], hints: string): string[] {
  const tokens = tokenize(hints);
  if (tokens.length === 0) return [];
  return files
    .map((file) => ({ file, score: scoreRelevantFile(file, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .map((x) => x.file)
    .slice(0, 12);
}

async function scanFiles(cwd: string): Promise<string[]> {
  try {
    const rootStat = await stat(cwd);
    if (!rootStat.isDirectory()) return [];
  } catch {
    return [];
  }
  const acc: string[] = [];
  await walk(cwd, cwd, acc);
  return acc;
}

function buildSourceMap(
  files: string[],
  packageScripts: string[],
  hints: string,
  userContext: string | undefined,
  generatedAt: string
): SourceMap {
  const languages: Record<string, number> = {};
  for (const file of files) {
    const lang = languageOf(file);
    if (lang) languages[lang] = (languages[lang] ?? 0) + 1;
  }

  const result: SourceMap = {
    schemaVersion: "0.5",
    engineVersion: ENGINE_VERSION,
    generatedAt,
    files,
    languages,
    packageScripts,
    docs: files.filter(isDocFile).slice(0, 12),
    tests: files.filter(isTestFile).slice(0, 12),
    riskFiles: files.filter(isRiskFile).slice(0, 12),
    relevantFiles: rankRelevantFiles(files, hints),
    limits: {
      maxFiles: MAX_FILES,
      scanned: files.length,
      truncated: files.length >= MAX_FILES
    }
  };
  if (userContext !== undefined) result.userContext = userContext;
  return result;
}

function renderList(items: string[], empty: string): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : `- ${empty}`;
}

function renderMarkdown(sm: SourceMap): string {
  const languages = Object.entries(sm.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count})`);

  return [
    "# Source Map",
    "",
    `> Auto-generated machine-readable snapshot. See \`source-map.json\` for the canonical artifact.`,
    "",
    `Generated: ${sm.generatedAt}`,
    `Engine: ${sm.engineVersion}`,
    `Scanned: ${sm.limits.scanned}/${sm.limits.maxFiles}${sm.limits.truncated ? " (truncated)" : ""}`,
    "",
    "## Source Files",
    renderList(sm.files.slice(0, 30), "no source files detected"),
    "",
    "## Suggested Relevant Files",
    renderList(sm.relevantFiles, "no task-specific file names detected yet"),
    "",
    "## Languages / File Types",
    renderList(languages, "no known languages detected"),
    "",
    "## Package Scripts",
    renderList(sm.packageScripts, "no package.json scripts detected"),
    "",
    "## Documentation",
    renderList(sm.docs, "none detected"),
    "",
    "## Tests",
    renderList(sm.tests, "none detected"),
    "",
    "## Risk-sensitive Files",
    renderList(sm.riskFiles, "none detected"),
    ""
  ].join("\n");
}

export async function runSourceMap(
  deps: StageDeps,
  input: SourceMapInput = {}
): Promise<SourceMapResult> {
  const files = await scanFiles(deps.cwd);
  const packageScripts = await readPackageScripts(deps.cwd);
  const sourceMap = buildSourceMap(
    files,
    packageScripts,
    input.hints ?? "",
    input.userContext,
    isoNow(deps.clock)
  );

  await deps.artifact.writeJson("source-map.json", sourceMap, "source-map");
  await deps.artifact.writeMarkdown("source-map.md", renderMarkdown(sourceMap));

  return {
    sourceMap,
    jsonPath: ".harness/source-map.json",
    markdownPath: ".harness/source-map.md"
  };
}
