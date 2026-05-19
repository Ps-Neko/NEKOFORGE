/**
 * Phase B M3a — 30초 path 전체 e2e.
 *
 * init → ask → context → spec → plan → design → policy → team
 *      → work → review → gate → apply → report → export claude
 *
 * 빈 SPEC answers JSON 을 통해 non-interactive 로 spec 통과.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, rm, writeFile, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const cliPath = resolve(__filename, "../../../src/cli/index.ts");

function runCli(args: string[], workspace: string): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", cliPath, ...args],
    {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, HARNESS_WORKSPACE: workspace }
    }
  );
}

const SPEC_ANSWERS = {
  who: "관리자 콘솔 사용자",
  why: "연속 실패 시 무차별 대입 방어",
  problemIfMissing: "계정 탈취 위험",
  coreFeatures: "5회 실패 시 30분 잠금",
  notDoing: "비밀번호 재설정 이메일",
  successCriteria: "잠금 발동률 ≥ 99%",
  failureCriteria: "정상 사용자 잠금 1% 이상"
};

test("M3a: full 30초 path runs end-to-end", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "vh-flow-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  // 1. init
  let r = runCli(["init"], cwd);
  assert.equal(r.status, 0, `init: ${r.stderr}`);
  await stat(join(cwd, ".harness")); // exists

  // 2. ask (goal triggers intake + clarify)
  r = runCli(["ask", "사용자 로그인 실패 시 잠금 기능 추가"], cwd);
  assert.equal(r.status, 0, `ask: ${r.stderr}`);

  // 3. context
  r = runCli(["context"], cwd);
  assert.equal(r.status, 0, `context: ${r.stderr}`);

  // 4. spec (non-interactive)
  const answersFile = join(cwd, "answers.json");
  await writeFile(answersFile, JSON.stringify(SPEC_ANSWERS), "utf8");
  r = runCli(["spec", "--non-interactive", "--answers", answersFile], cwd);
  assert.equal(r.status, 0, `spec: ${r.stderr}`);

  // 5. plan
  r = runCli(["plan"], cwd);
  assert.equal(r.status, 0, `plan: ${r.stderr}`);

  // 6. design
  r = runCli(["design", "--pattern", "Producer-Reviewer"], cwd);
  assert.equal(r.status, 0, `design: ${r.stderr}`);

  // 7. policy
  r = runCli(["policy"], cwd);
  assert.equal(r.status, 0, `policy: ${r.stderr}`);

  // 테스트 환경에서 외부 spawn 회피 — hooks.json 을 noop 로 덮어씀.
  // 실제 사용자 환경에서는 quality-policy default (npx tsc --noEmit) 이 동작.
  await writeFile(
    join(cwd, ".harness", "hooks.json"),
    JSON.stringify({
      schemaVersion: "0.3",
      hooks: [
        { id: "noop-pre", type: "pre-tool", command: "internal:noop" },
        { id: "noop-post", type: "post-tool", command: "internal:noop" }
      ]
    }),
    "utf8"
  );

  // 8. team
  r = runCli(["team"], cwd);
  assert.equal(r.status, 0, `team: ${r.stderr}`);

  // 9. work (TASK-001 is the template default)
  r = runCli(["work", "TASK-001"], cwd);
  assert.equal(r.status, 0, `work: ${r.stderr}`);

  // 10. review (no adapter)
  r = runCli(["review", "--adapter", "none"], cwd);
  assert.equal(r.status, 0, `review: ${r.stderr}`);

  // 11. gate
  r = runCli(["gate", "--task", "TASK-001", "--test-status", "passed"], cwd);
  assert.equal(r.status, 0, `gate: ${r.stderr}`);
  const decisionText = await readFile(
    join(cwd, ".harness", "decision.json"),
    "utf8"
  );
  const decision = JSON.parse(decisionText) as { verdict: string };
  assert.match(decision.verdict, /^(PASS|PASS_WITH_WARNINGS|NEEDS_HUMAN_REVIEW)$/);

  // REPORT.md exists
  await stat(join(cwd, "REPORT.md"));

  // 12. apply (only if verdict permits)
  if (decision.verdict === "PASS" || decision.verdict === "PASS_WITH_WARNINGS") {
    r = runCli(["apply", "--approved"], cwd);
    assert.equal(r.status, 0, `apply: ${r.stderr}`);
  }

  // 13. report
  r = runCli(["report"], cwd);
  assert.equal(r.status, 0, `report: ${r.stderr}`);

  // 14. export claude
  r = runCli(["export", "claude"], cwd);
  assert.equal(r.status, 0, `export: ${r.stderr}`);
  await stat(join(cwd, ".claude", "agents"));
  await stat(join(cwd, "CLAUDE.md"));

  // 15. Phase C: audit.jsonl 누적 확인
  const auditText = await readFile(join(cwd, ".harness", "audit.jsonl"), "utf8");
  const auditLines = auditText.trim().split("\n").filter((l) => l.length > 0);
  assert.ok(
    auditLines.length >= 14,
    `expected ≥14 audit lines (start+end per command), got ${auditLines.length}`
  );
  const types = new Set(
    auditLines.map((l) => (JSON.parse(l) as { type: string }).type)
  );
  assert.ok(types.has("command_start"));
  assert.ok(types.has("command_end"));
  assert.ok(types.has("gate_verdict"));
});
