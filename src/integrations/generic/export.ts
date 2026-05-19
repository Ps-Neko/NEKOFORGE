/**
 * Generic export adapter (Phase D 후속).
 *
 * .harness/ 의 핵심 산출물을 도구 독립 표준 형식으로 `.export/` 에 복사한다.
 *
 * 출력:
 *   .export/team.json
 *   .export/skills-map.json (있으면)
 *   .export/quality-policy.md (있으면)
 *   .export/manifest.json — 본 export 의 요약
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, isAbsolute, relative, sep } from "node:path";

export const GENERIC_ALLOWED_INPUTS = [
  "team.json",
  "skills-map.json",
  "quality-policy.md",
  "rules.json",
  "hooks.json",
  "orchestrator.md"
] as const;

const OUTPUT_ROOT_REL = ".export";

export interface ExportGenericInput {
  cwd: string;
}

export interface ExportGenericResult {
  files: string[];
  manifest: string;
}

export class GenericExportPathViolationError extends Error {
  readonly exitCode = 70;
  constructor(path: string) {
    super(`generic export blocked: path outside whitelist: ${path}`);
    this.name = "GenericExportPathViolationError";
  }
}

export class GenericExportPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`generic export requires ${missing}`);
    this.name = "GenericExportPrecondError";
  }
}

function checkPath(p: string, base: string): void {
  if (isAbsolute(p)) throw new GenericExportPathViolationError(p);
  const rel = relative(base, join(base, p));
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new GenericExportPathViolationError(p);
  }
}

async function tryRead(
  harnessRoot: string,
  name: string
): Promise<string | null> {
  if (
    !GENERIC_ALLOWED_INPUTS.includes(
      name as (typeof GENERIC_ALLOWED_INPUTS)[number]
    )
  ) {
    throw new GenericExportPathViolationError(name);
  }
  checkPath(name, harnessRoot);
  try {
    return await readFile(join(harnessRoot, name), "utf8");
  } catch {
    return null;
  }
}

export async function exportGeneric(
  input: ExportGenericInput
): Promise<ExportGenericResult> {
  const harnessRoot = join(input.cwd, ".harness");
  try {
    await stat(harnessRoot);
  } catch {
    throw new GenericExportPrecondError(
      ".harness/ (run `harness init` first)"
    );
  }

  const outRoot = join(input.cwd, OUTPUT_ROOT_REL);
  await mkdir(outRoot, { recursive: true });

  const files: string[] = [];
  const copied: Record<string, boolean> = {};
  for (const name of GENERIC_ALLOWED_INPUTS) {
    const text = await tryRead(harnessRoot, name);
    if (text === null) {
      copied[name] = false;
      continue;
    }
    const out = join(outRoot, name);
    await writeFile(out, text, "utf8");
    files.push(out);
    copied[name] = true;
  }

  const manifest = {
    schemaVersion: "0.3",
    format: "generic",
    copied,
    generatedBy: "harness export generic"
  };
  const manifestFile = join(outRoot, "manifest.json");
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return { files, manifest: manifestFile };
}
