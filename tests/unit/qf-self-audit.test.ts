/**
 * Phase QF self-audit 회귀 테스트.
 * #1 release mode benchmark 강제, #2 productIntent placeholder lint.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runQualityContract,
  ContractCheckError
} from "../../src/core/quality-contract/index.js";
import { runGate } from "../../src/core/gate/index.js";
import { seedHarness } from "../e2e/_seed.js";
import { buildDeps } from "../../src/core/stage-runner.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-qf-audit-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// === #2 productIntent placeholder lint ===
test("self-audit #2: contract --check rejects placeholder productIntent", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await writeFile(join(dir, ".harness", "SPEC.md"), "# SPEC\n", "utf8");
    // 기본 template 으로 contract 생성 (productIntent 가 placeholder)
    await runQualityContract({ template: "custom" }, buildDeps(dir));
    // --check 가 placeholder 거부
    await assert.rejects(
      () => runQualityContract({ check: true }, buildDeps(dir)),
      ContractCheckError
    );
  });
});

test("self-audit #2: contract --check passes when productIntent filled", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await writeFile(join(dir, ".harness", "SPEC.md"), "# SPEC\n", "utf8");
    // 채워진 answers 로 contract 생성
    const answersFile = join(dir, "answers.json");
    await writeFile(
      answersFile,
      JSON.stringify({
        user: "관리자 콘솔 사용자",
        problem: "무차별 대입 방어",
        coreValue: "5회 실패 시 30분 잠금",
        nonGoals: []
      }),
      "utf8"
    );
    await runQualityContract(
      { template: "custom", answersFile },
      buildDeps(dir)
    );
    const r = await runQualityContract({ check: true }, buildDeps(dir));
    assert.equal(r.template, "custom");
  });
});

// === #1 release mode benchmark 강제 ===
test("self-audit #1: gate --mode release without benchmark → finding triggered", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  // last-diff.patch 가 비어 있어 다른 finding 적음
  const result = await runGate(
    { taskId: "TASK-001", testStatus: "passed", mode: "release" },
    ws.deps
  );
  const text = await readFile(
    join(ws.cwd, ".harness", "decision.json"),
    "utf8"
  );
  const d = JSON.parse(text) as {
    deterministicRules?: { triggeredRules: string[] };
  };
  assert.ok(
    (d.deterministicRules?.triggeredRules ?? []).includes(
      "release-benchmark-required"
    ),
    `expected release-benchmark-required in triggered: ${JSON.stringify(d.deterministicRules)}`
  );
  // verdict 가 PASS 가 아님
  assert.notEqual(result.verdict, "PASS");
});

test("self-audit #1: gate --mode safe does not require benchmark", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  const result = await runGate(
    { taskId: "TASK-001", testStatus: "passed", mode: "safe" },
    ws.deps
  );
  const text = await readFile(
    join(ws.cwd, ".harness", "decision.json"),
    "utf8"
  );
  const d = JSON.parse(text) as {
    deterministicRules?: { triggeredRules: string[] };
  };
  assert.ok(
    !(d.deterministicRules?.triggeredRules ?? []).includes(
      "release-benchmark-required"
    )
  );
  // safe 모드는 정상 verdict
  assert.match(result.verdict, /PASS|NEEDS_HUMAN_REVIEW/);
});
