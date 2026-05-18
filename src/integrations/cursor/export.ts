/**
 * Cursor export adapter (Phase D).
 *
 * 입력 : .harness/team.json, .harness/skills-map.json, .harness/quality-policy.md, .harness/rules.json
 * 출력 : .cursor/rules/*.md (cursorrules 호환 markdown), .cursor/context/<agent>.md
 *
 * 규칙 (SECURITY.md §11 동일):
 * - 단방향. `.cursor/` 를 읽지 않는다.
 * - 결정적. 동일 입력 → 동일 출력.
 * - 화이트리스트 입력만 사용.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, isAbsolute, relative, sep } from "node:path";

export const CURSOR_ALLOWED_INPUTS = [
  "team.json",
  "skills-map.json",
  "quality-policy.md",
  "rules.json"
] as const;

const OUTPUT_ROOT_REL = ".cursor";

export interface ExportCursorInput {
  cwd: string;
}

export interface ExportCursorResult {
  ruleFiles: string[];
  contextFiles: string[];
}

export class CursorExportPathViolationError extends Error {
  readonly exitCode = 70;
  constructor(path: string) {
    super(`cursor export blocked: path outside whitelist: ${path}`);
    this.name = "CursorExportPathViolationError";
  }
}

export class CursorExportPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`cursor export requires ${missing}`);
    this.name = "CursorExportPrecondError";
  }
}

interface TeamJson {
  pattern: string;
  agents: Array<{ id: string; role: string; owns: string[] }>;
}

interface RulesJson {
  applied: Array<{ id: string; title: string; severity: string; scope: string[] }>;
}

function checkPath(p: string, base: string): void {
  if (isAbsolute(p)) throw new CursorExportPathViolationError(p);
  const rel = relative(base, join(base, p));
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new CursorExportPathViolationError(p);
  }
}

export async function readCursorInputFile(
  harnessRoot: string,
  name: string
): Promise<string> {
  if (
    !CURSOR_ALLOWED_INPUTS.includes(
      name as (typeof CURSOR_ALLOWED_INPUTS)[number]
    )
  ) {
    throw new CursorExportPathViolationError(name);
  }
  checkPath(name, harnessRoot);
  return readFile(join(harnessRoot, name), "utf8");
}

export async function exportCursor(
  input: ExportCursorInput
): Promise<ExportCursorResult> {
  const harnessRoot = join(input.cwd, ".harness");
  try {
    await stat(harnessRoot);
  } catch {
    throw new CursorExportPrecondError(".harness/ (run `harness init` first)");
  }
  try {
    await stat(join(harnessRoot, "team.json"));
  } catch {
    throw new CursorExportPrecondError("team.json (run `harness design`)");
  }

  const team: TeamJson = JSON.parse(
    await readCursorInputFile(harnessRoot, "team.json")
  );
  const rulesText = await readCursorInputFile(harnessRoot, "rules.json").catch(
    () => null
  );
  const rules: RulesJson = rulesText
    ? JSON.parse(rulesText)
    : { applied: [] };
  const policy =
    (await readCursorInputFile(harnessRoot, "quality-policy.md").catch(
      () => null
    )) ?? "";

  const outRoot = join(input.cwd, OUTPUT_ROOT_REL);
  const rulesDir = join(outRoot, "rules");
  const contextDir = join(outRoot, "context");
  await mkdir(rulesDir, { recursive: true });
  await mkdir(contextDir, { recursive: true });

  const policyFile = join(rulesDir, "quality-policy.md");
  await writeFile(
    policyFile,
    `# Quality Policy (from .harness/)\n\n${policy}\n`,
    "utf8"
  );

  const appliedFile = join(rulesDir, "applied-rules.md");
  const appliedMd = [
    "# Applied Rules",
    "",
    "| id | title | severity | scope |",
    "|---|---|---|---|",
    ...rules.applied.map(
      (r) =>
        `| ${r.id} | ${r.title} | ${r.severity} | ${(r.scope ?? []).join(", ")} |`
    )
  ].join("\n");
  await writeFile(appliedFile, appliedMd + "\n", "utf8");

  const contextFiles: string[] = [];
  for (const agent of team.agents) {
    const file = join(contextDir, `${agent.id}.md`);
    const md = [
      `# ${agent.id} (${agent.role})`,
      "",
      `- pattern: ${team.pattern}`,
      `- owns: ${agent.owns.join(", ")}`,
      "",
      `Generated from .harness/team.json by harness export cursor.`,
      ""
    ].join("\n");
    await writeFile(file, md, "utf8");
    contextFiles.push(file);
  }

  return {
    ruleFiles: [policyFile, appliedFile],
    contextFiles
  };
}
