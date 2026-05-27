/**
 * Phase B M1 통합 테스트.
 * 14 명령 모두 `harness <cmd> --help` 호출 시 exit 0 을 반환하는지 확인한다.
 *
 * 실행 전 사용자 환경에서 `npm install` 이 필요하다 (commander 등).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, "../../src/cli/index.ts");

const COMMANDS = [
  // M1 14 명령
  "init",
  "ask",
  "context",
  "spec",
  "plan",
  "design",
  "policy",
  "team",
  "work",
  "review",
  "gate",
  "apply",
  "report",
  "export",
  // Phase QF / self-host 신규
  "memory",
  "contract",
  "benchmark",
  "run",
  "self-host",
  "demo",
  "auto",
  // Phase WF/RP 신규
  "workers",
  "dispatch",
  "worker-result",
  "rule-pack",
  "skill-pack",
  // Phase UX 9점화 신규
  "doctor",
  // Promotion Gate P1b
  "promote"
] as const;

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): RunResult {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", cliPath, ...args],
    { encoding: "utf8" }
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

test("harness --help exits 0 and prints program description", () => {
  const r = runCli(["--help"]);
  assert.equal(r.status, 0, `unexpected stderr: ${r.stderr}`);
  assert.match(r.stdout, /NEKOFORGE/);
});

test("harness --version exits 0 and prints version", () => {
  const r = runCli(["--version"]);
  assert.equal(r.status, 0, `unexpected stderr: ${r.stderr}`);
  assert.match(r.stdout, /0\.5\.0/);
});

test("harness lists all 28 commands in --help", () => {
  const r = runCli(["--help"]);
  assert.equal(r.status, 0);
  for (const cmd of COMMANDS) {
    assert.match(
      r.stdout,
      new RegExp(`\\b${cmd}\\b`),
      `command "${cmd}" missing from --help output`
    );
  }
});

for (const cmd of COMMANDS) {
  test(`harness ${cmd} --help exits 0`, () => {
    const r = runCli([cmd, "--help"]);
    assert.equal(
      r.status,
      0,
      `${cmd} --help exited ${r.status}; stderr: ${r.stderr}`
    );
  });
}
