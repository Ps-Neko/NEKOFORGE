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

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "unknown";

export interface BuildCommands {
  build?: string;
  test?: string;
  typecheck?: string;
  lint?: string;
}

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
  entrypoints?: string[];
  framework?: string;
  packageManager?: PackageManager;
  testRunner?: string;
  buildCommands?: BuildCommands;
}

interface PackageJson {
  scripts?: Record<string, string>;
  main?: string;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_PRIORITY: Array<{ name: string; deps: string[] }> = [
  { name: "next", deps: ["next"] },
  { name: "nuxt", deps: ["nuxt"] },
  { name: "remix", deps: ["@remix-run/react"] },
  { name: "gatsby", deps: ["gatsby"] },
  { name: "nest", deps: ["@nestjs/core"] },
  { name: "express", deps: ["express"] },
  { name: "fastify", deps: ["fastify"] },
  { name: "koa", deps: ["koa"] },
  { name: "hapi", deps: ["@hapi/hapi"] },
  { name: "electron", deps: ["electron"] },
  { name: "react", deps: ["react"] },
  { name: "vue", deps: ["vue"] },
  { name: "svelte", deps: ["svelte"] },
  { name: "solid", deps: ["solid-js"] }
];

const TEST_RUNNER_PRIORITY: Array<{ name: string; deps: string[] }> = [
  { name: "playwright", deps: ["@playwright/test", "playwright"] },
  { name: "cypress", deps: ["cypress"] },
  { name: "vitest", deps: ["vitest"] },
  { name: "jest", deps: ["jest"] },
  { name: "mocha", deps: ["mocha"] },
  { name: "ava", deps: ["ava"] },
  { name: "tap", deps: ["tap"] }
];

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

async function readPackageJson(cwd: string): Promise<PackageJson | null> {
  try {
    const text = await readFile(join(cwd, "package.json"), "utf8");
    return JSON.parse(text) as PackageJson;
  } catch {
    return null;
  }
}

function readPackageScripts(pkg: PackageJson | null): string[] {
  if (!pkg) return [];
  return Object.entries(pkg.scripts ?? {}).map(([name, cmd]) => `${name}: ${cmd}`);
}

function detectEntrypoints(pkg: PackageJson | null): string[] | undefined {
  if (!pkg) return undefined;
  const entries: string[] = [];
  if (typeof pkg.main === "string" && pkg.main.length > 0) entries.push(pkg.main);
  if (typeof pkg.bin === "string" && pkg.bin.length > 0) entries.push(pkg.bin);
  if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values(pkg.bin)) {
      if (typeof value === "string" && value.length > 0) entries.push(value);
    }
  }
  if (entries.length === 0) return undefined;
  return [...new Set(entries)];
}

function detectFramework(pkg: PackageJson | null): string | undefined {
  if (!pkg) return undefined;
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const { name, deps } of FRAMEWORK_PRIORITY) {
    if (deps.some((d) => d in all)) return name;
  }
  return undefined;
}

function detectTestRunner(pkg: PackageJson | null): string | undefined {
  if (!pkg) return undefined;
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const { name, deps } of TEST_RUNNER_PRIORITY) {
    if (deps.some((d) => d in all)) return name;
  }
  const testScript = pkg.scripts?.test;
  if (testScript && /node\s+--test/.test(testScript)) return "node:test";
  return undefined;
}

async function detectPackageManager(cwd: string): Promise<PackageManager | undefined> {
  const candidates: Array<[string, PackageManager]> = [
    ["bun.lockb", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"]
  ];
  for (const [file, manager] of candidates) {
    try {
      await stat(join(cwd, file));
      return manager;
    } catch {
      continue;
    }
  }
  try {
    await stat(join(cwd, "package.json"));
    return "unknown";
  } catch {
    return undefined;
  }
}

function detectBuildCommands(pkg: PackageJson | null): BuildCommands | undefined {
  if (!pkg?.scripts) return undefined;
  const result: BuildCommands = {};
  if (pkg.scripts.build) result.build = pkg.scripts.build;
  if (pkg.scripts.test) result.test = pkg.scripts.test;
  if (pkg.scripts.typecheck) result.typecheck = pkg.scripts.typecheck;
  if (pkg.scripts.lint) result.lint = pkg.scripts.lint;
  return Object.keys(result).length > 0 ? result : undefined;
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

interface ProjectEnrichment {
  entrypoints: string[] | undefined;
  framework: string | undefined;
  packageManager: PackageManager | undefined;
  testRunner: string | undefined;
  buildCommands: BuildCommands | undefined;
}

function buildSourceMap(
  files: string[],
  packageScripts: string[],
  enrichment: ProjectEnrichment,
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
  if (enrichment.entrypoints) result.entrypoints = enrichment.entrypoints;
  if (enrichment.framework) result.framework = enrichment.framework;
  if (enrichment.packageManager) result.packageManager = enrichment.packageManager;
  if (enrichment.testRunner) result.testRunner = enrichment.testRunner;
  if (enrichment.buildCommands) result.buildCommands = enrichment.buildCommands;
  return result;
}

function renderList(items: string[], empty: string): string {
  return items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : `- ${empty}`;
}

function renderProjectProfile(sm: SourceMap): string[] {
  const lines: string[] = [];
  if (sm.framework) lines.push(`- framework: ${sm.framework}`);
  if (sm.packageManager) lines.push(`- package manager: ${sm.packageManager}`);
  if (sm.testRunner) lines.push(`- test runner: ${sm.testRunner}`);
  if (sm.entrypoints && sm.entrypoints.length > 0) {
    lines.push(`- entrypoints: ${sm.entrypoints.join(", ")}`);
  }
  if (sm.buildCommands) {
    const bc = sm.buildCommands;
    if (bc.build) lines.push(`- build: \`${bc.build}\``);
    if (bc.test) lines.push(`- test: \`${bc.test}\``);
    if (bc.typecheck) lines.push(`- typecheck: \`${bc.typecheck}\``);
    if (bc.lint) lines.push(`- lint: \`${bc.lint}\``);
  }
  return lines;
}

function renderMarkdown(sm: SourceMap): string {
  const languages = Object.entries(sm.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count})`);
  const profile = renderProjectProfile(sm);

  return [
    "# Source Map",
    "",
    `> Auto-generated machine-readable snapshot. See \`source-map.json\` for the canonical artifact.`,
    "",
    `Generated: ${sm.generatedAt}`,
    `Engine: ${sm.engineVersion}`,
    `Scanned: ${sm.limits.scanned}/${sm.limits.maxFiles}${sm.limits.truncated ? " (truncated)" : ""}`,
    "",
    ...(profile.length > 0
      ? ["## Project Profile", profile.join("\n"), ""]
      : []),
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
  const pkg = await readPackageJson(deps.cwd);
  const enrichment: ProjectEnrichment = {
    entrypoints: detectEntrypoints(pkg),
    framework: detectFramework(pkg),
    packageManager: await detectPackageManager(deps.cwd),
    testRunner: detectTestRunner(pkg),
    buildCommands: detectBuildCommands(pkg)
  };
  const sourceMap = buildSourceMap(
    files,
    readPackageScripts(pkg),
    enrichment,
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
