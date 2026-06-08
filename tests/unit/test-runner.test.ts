/**
 * 테스트 러너 디스커버리 회귀 가드.
 *
 * 배경: 기존 `npm test` 스크립트는 `tests/** /*.test.ts` 글롭에 의존했는데,
 * POSIX sh(dash, globstar OFF)에서 `**` 가 한 단계로 축소돼 depth-3 파일(27개)만
 * 실행되고 depth-4/5 의 해자 테스트(audit/gate/promotion)가 통째로 누락됐다.
 * 이 가드는 디스커버리가 셸/노드 버전과 무관하게 *모든* `*.test.ts` 를 집어내는지 검증한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collectTestFiles } from "../../scripts/run-tests.mjs";

const here = fileURLToPath(import.meta.url);
const repoRoot = resolve(here, "..", "..", ".."); // tests/unit/test-runner.test.ts → repo
const testsDir = join(repoRoot, "tests");

/** 디스커버리와 독립적인 진실값: 직접 재귀 walk. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

test("collectTestFiles: tests/ 아래 모든 *.test.ts 를 글롭-깊이 손실 없이 집어낸다", () => {
  const truth = walk(testsDir).sort();
  const found = collectTestFiles(testsDir).map(String).sort();
  assert.deepEqual(found, truth);
});

test("collectTestFiles: 버그 글롭이 누락시켰던 depth-4 해자 스위트를 포함한다", () => {
  const found = collectTestFiles(testsDir).map((p) => p.split(sep).join("/"));
  for (const moat of [
    "tests/unit/utils/audit.test.ts",
    "tests/unit/gate/verdict.test.ts",
    "tests/unit/promotion/ledger.test.ts"
  ]) {
    assert.ok(
      found.some((p) => p.endsWith(moat)),
      `해자 스위트 누락: ${moat}`
    );
  }
  // 버그는 27개만 산출했다 — 디스커버리는 그보다 훨씬 많아야 한다.
  assert.ok(
    found.length > 50,
    `expected >50 test files, got ${found.length}`
  );
});
