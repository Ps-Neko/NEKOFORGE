/**
 * Codex export adapter (Phase D 후속).
 *
 * 입력 : .harness/team.json, .harness/skills-map.json, .harness/quality-policy.md
 * 출력 : .codex/agents/<id>.md, .codex/policy.md, .codex/orchestrator.md (옵션)
 *
 * 규칙 (SECURITY.md §11):
 * - 단방향. `.codex/` 를 읽지 않는다.
 * - 결정적. 동일 입력 → 동일 출력.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, isAbsolute, relative, sep } from "node:path";

export const CODEX_ALLOWED_INPUTS = [
  "team.json",
  "skills-map.json",
  "quality-policy.md",
  "orchestrator.md"
] as const;

const OUTPUT_ROOT_REL = ".codex";

export interface ExportCodexInput {
  cwd: string;
}

export interface ExportCodexResult {
  agents: string[];
  policy: string;
}

export class CodexExportPathViolationError extends Error {
  readonly exitCode = 70;
  constructor(path: string) {
    super(`codex export blocked: path outside whitelist: ${path}`);
    this.name = "CodexExportPathViolationError";
  }
}

export class CodexExportPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`codex export requires ${missing}`);
    this.name = "CodexExportPrecondError";
  }
}

interface TeamJson {
  pattern: string;
  agents: Array<{ id: string; role: string; owns: string[] }>;
}

function checkPath(p: string, base: string): void {
  if (isAbsolute(p)) throw new CodexExportPathViolationError(p);
  const rel = relative(base, join(base, p));
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new CodexExportPathViolationError(p);
  }
}

export async function readCodexInputFile(
  harnessRoot: string,
  name: string
): Promise<string> {
  if (
    !CODEX_ALLOWED_INPUTS.includes(
      name as (typeof CODEX_ALLOWED_INPUTS)[number]
    )
  ) {
    throw new CodexExportPathViolationError(name);
  }
  checkPath(name, harnessRoot);
  return readFile(join(harnessRoot, name), "utf8");
}

export async function exportCodex(
  input: ExportCodexInput
): Promise<ExportCodexResult> {
  const harnessRoot = join(input.cwd, ".harness");
  try {
    await stat(harnessRoot);
  } catch {
    throw new CodexExportPrecondError(".harness/ (run `harness init` first)");
  }
  try {
    await stat(join(harnessRoot, "team.json"));
  } catch {
    throw new CodexExportPrecondError("team.json (run `harness design`)");
  }

  const team: TeamJson = JSON.parse(
    await readCodexInputFile(harnessRoot, "team.json")
  );
  const policy =
    (await readCodexInputFile(harnessRoot, "quality-policy.md").catch(
      () => null
    )) ?? "# Quality Policy\n";

  const outRoot = join(input.cwd, OUTPUT_ROOT_REL);
  await mkdir(join(outRoot, "agents"), { recursive: true });

  const agentFiles: string[] = [];
  for (const agent of team.agents) {
    const file = join(outRoot, "agents", `${agent.id}.md`);
    const md = [
      `# ${agent.id}`,
      "",
      `role: ${agent.role}`,
      `pattern: ${team.pattern}`,
      `owns: ${agent.owns.join(", ")}`,
      "",
      `Generated from .harness/team.json by harness export codex.`,
      ""
    ].join("\n");
    await writeFile(file, md, "utf8");
    agentFiles.push(file);
  }

  const policyFile = join(outRoot, "policy.md");
  await writeFile(
    policyFile,
    `# Policy (from .harness/)\n\n${policy}\n`,
    "utf8"
  );

  return { agents: agentFiles, policy: policyFile };
}
