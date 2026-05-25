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

  // Phase QF — work 전에 quality-contract 필수.
  // self-audit #2-1 — productIntent 채워야 work 통과.
  const contractAnswers = join(cwd, "contract-answers.json");
  await writeFile(
    contractAnswers,
    JSON.stringify({
      user: "test user",
      problem: "test problem",
      coreValue: "test value"
    }),
    "utf8"
  );
  r = runCli(
    [
      "contract",
      "--template",
      "custom",
      "--task",
      "TASK-001",
      "--answers",
      contractAnswers
    ],
    cwd
  );
  assert.equal(r.status, 0, `contract: ${r.stderr}`);

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

  // ⓒ 무결성: decision.json 을 gate 이후 사후 변조하면 apply 가 거부한다.
  // (무결성 체크는 evidence/drift 검사보다 먼저 early-throw 하므로 .harness 상태를
  //  건드리지 않는다 → 원복 후 정상 apply 가 그대로 이어진다)
  {
    const tampered = JSON.parse(decisionText) as { verdict: string };
    tampered.verdict =
      tampered.verdict === "PASS" ? "PASS_WITH_WARNINGS" : "PASS";
    await writeFile(
      join(cwd, ".harness", "decision.json"),
      JSON.stringify(tampered, null, 2) + "\n",
      "utf8"
    );
    const bad = runCli(["apply", "--approved"], cwd);
    assert.notEqual(bad.status, 0, "tampered decision.json must be rejected");
    assert.match(
      bad.stderr,
      /integrity check failed/,
      `expected integrity rejection, got: ${bad.stderr}`
    );
    // 원복 — 이후 정상 apply 가 동작하도록 원본 바이트로 복구.
    await writeFile(
      join(cwd, ".harness", "decision.json"),
      decisionText,
      "utf8"
    );
  }

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

  // 4,5 — gate_verdict 가 입력 diff 와 decision 을 content hash 로 결박(증거 추적성).
  const gv = auditLines
    .map(
      (l) =>
        JSON.parse(l) as {
          type: string;
          inputDiffHash?: string;
          decisionHash?: string;
        }
    )
    .find((e) => e.type === "gate_verdict");
  assert.match(gv?.inputDiffHash ?? "", /^[0-9a-f]{64}$/, "gate_verdict.inputDiffHash 결박");
  assert.match(gv?.decisionHash ?? "", /^[0-9a-f]{64}$/, "gate_verdict.decisionHash 결박");
  // 2 — 어느 엔진 버전이 판정했는지 audit 에 기록(추적성)
  assert.ok(
    (gv as { engineVersion?: string })?.engineVersion,
    "gate_verdict.engineVersion 기록"
  );
});
