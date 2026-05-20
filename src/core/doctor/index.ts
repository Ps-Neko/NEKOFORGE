/**
 * harness doctor (Phase UX) — 환경/워크스페이스 진단.
 *
 * 12 검사 항목. 산출: .harness/doctor-report.{md,json}.
 * 외부 의존 spawn 회피 — 검사는 cwd 의 파일 시스템만 본다.
 */
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../stage-runner.js";

export type DoctorStatus = "ok" | "warn" | "error";

export interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  message: string;
  fix?: string;
}

export interface DoctorReport {
  schemaVersion: "0.5";
  generatedAt: string;
  nodeVersion: string;
  cwd: string;
  checks: DoctorCheck[];
  summary: { ok: number; warn: number; error: number };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function pathExistsInCwd(cwd: string, rel: string): Promise<boolean> {
  return exists(join(cwd, rel));
}

async function harnessFileExists(
  cwd: string,
  name: string
): Promise<boolean> {
  return exists(join(cwd, ".harness", name));
}

function nodeVersionCheck(): DoctorCheck {
  const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return major >= 20
    ? { id: "node-version", status: "ok", message: `Node.js ${process.versions.node} >= 20` }
    : {
        id: "node-version",
        status: "error",
        message: `Node.js ${process.versions.node} < 20`,
        fix: "Install Node.js 20 LTS or later"
      };
}

export async function runDoctor(deps: StageDeps): Promise<DoctorReport> {
  const cwd = deps.cwd;
  const checks: DoctorCheck[] = [];

  checks.push(nodeVersionCheck());

  const gitOk = await pathExistsInCwd(cwd, ".git");
  checks.push(
    gitOk
      ? { id: "git-repo", status: "ok", message: "git repository detected" }
      : {
          id: "git-repo",
          status: "warn",
          message: ".git not found — diff capture may be limited",
          fix: "git init"
        }
  );

  const harnessOk = await pathExistsInCwd(cwd, ".harness");
  checks.push(
    harnessOk
      ? { id: "harness-dir", status: "ok", message: ".harness/ exists" }
      : {
          id: "harness-dir",
          status: "warn",
          message: ".harness/ missing",
          fix: "harness init"
        }
  );

  const pkgOk = await pathExistsInCwd(cwd, "package.json");
  checks.push(
    pkgOk
      ? { id: "package-json", status: "ok", message: "package.json present" }
      : {
          id: "package-json",
          status: "warn",
          message: "package.json missing — only basic gate checks will run",
          fix: "npm init -y"
        }
  );

  const nmOk = await pathExistsInCwd(cwd, "node_modules");
  checks.push(
    nmOk
      ? { id: "node-modules", status: "ok", message: "node_modules present (npm install done)" }
      : {
          id: "node-modules",
          status: "warn",
          message: "node_modules missing",
          fix: "npm install"
        }
  );

  // test script 존재 (rough)
  let testScript = false;
  if (pkgOk) {
    try {
      const { readFile } = await import("node:fs/promises");
      const pkg = JSON.parse(
        await readFile(join(cwd, "package.json"), "utf8")
      ) as { scripts?: Record<string, string> };
      testScript = typeof pkg.scripts?.test === "string";
    } catch {
      testScript = false;
    }
  }
  checks.push(
    testScript
      ? { id: "test-script", status: "ok", message: "npm test script defined" }
      : {
          id: "test-script",
          status: "warn",
          message: "no `test` script in package.json",
          fix: "add 'test' to package.json scripts"
        }
  );

  const benchOk = await pathExistsInCwd(cwd, "fixtures");
  checks.push(
    benchOk
      ? { id: "benchmark-fixtures", status: "ok", message: "fixtures/ directory present" }
      : {
          id: "benchmark-fixtures",
          status: "warn",
          message: "fixtures/ directory missing — benchmark not available",
          fix: "create fixtures/<group>/<scenario>/{last-diff.patch,expected.json}"
        }
  );

  // adapter CLI 감지 (실제 spawn 회피 — PATH 기반 휴리스틱 미사용. 현재는 파일 존재로만)
  // codex/claude CLI 가 PATH 에 있는지 정확히 알 수 없으므로 'unknown' 표시.
  checks.push({
    id: "review-adapters",
    status: "warn",
    message: "external review adapter availability not probed (provide via --adapter at review stage)"
  });

  // .harness/ 산출물
  const wantedFiles: Array<{ name: string; fix: string; required: boolean }> = [
    {
      name: "workers.json",
      fix: "harness workers init --profile standard",
      required: true
    },
    {
      name: "rule-packs.json",
      fix: "harness rule-pack audit",
      required: true
    },
    {
      name: "skill-packs.json",
      fix: "harness skill-pack audit",
      required: true
    },
    {
      name: "quality-contract.json",
      fix: "harness contract --template cli-tool --task TASK-001",
      required: true
    }
  ];
  for (const f of wantedFiles) {
    const ok = await harnessFileExists(cwd, f.name);
    checks.push(
      ok
        ? { id: f.name, status: "ok", message: `.harness/${f.name} present` }
        : {
            id: f.name,
            status: f.required ? "warn" : "ok",
            message: `.harness/${f.name} missing`,
            fix: f.fix
          }
    );
  }

  const summary = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { ok: 0, warn: 0, error: 0 }
  );

  return {
    schemaVersion: "0.5",
    generatedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    cwd,
    checks,
    summary
  };
}

export function renderDoctorMd(r: DoctorReport): string {
  const lines: string[] = [
    `# harness doctor — ${r.generatedAt}`,
    "",
    `- cwd: \`${r.cwd}\``,
    `- node: ${r.nodeVersion}`,
    `- summary: ok=${r.summary.ok} warn=${r.summary.warn} error=${r.summary.error}`,
    "",
    "## Checks",
    ""
  ];
  for (const c of r.checks) {
    const icon = c.status === "ok" ? "✓" : c.status === "warn" ? "!" : "✗";
    lines.push(`- [${icon}] ${c.id}: ${c.message}`);
    if (c.fix) lines.push(`    fix: \`${c.fix}\``);
  }
  return lines.join("\n");
}
