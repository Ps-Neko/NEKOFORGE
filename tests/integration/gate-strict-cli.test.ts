/**
 * gate --strict 의 CLI→process.exit 배선 통합 테스트(spawn).
 *
 * 기존엔 gateStrictExitCode 함수 단위 테스트만 있고, --strict 플래그가 실제
 * 프로세스 종료 코드로 이어지는 배선은 어떤 테스트도 spawn 으로 검증하지 않았다.
 * CI 게이팅이 이 종료 코드에 의존하므로 end-to-end 로 못 박는다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedHarness, writeLastDiff, diffLines } from "../e2e/_seed.js";

const cliPath = resolve(
  fileURLToPath(import.meta.url),
  "../../../src/cli/index.ts"
);

function runGateCli(ws: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      cliPath,
      "gate",
      "--task",
      "TASK-001",
      "--test-status",
      "passed",
      ...args
    ],
    {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, HARNESS_WORKSPACE: ws }
    }
  );
}

test("gate --strict CLI: BLOCK verdict exits 4; same gate without --strict exits 0", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/src/config.ts b/src/config.ts",
      "@@ -1 +1 @@",
      "-const x = 1;",
      '+const KEY = process.env.API_KEY || "sk-test-fallback-12345";'
    )
  );

  // 비-strict: verdict 가 BLOCK 이어도 gate 자체는 0 으로 끝난다(판정만 기록).
  const lenient = runGateCli(ws.cwd, []);
  assert.equal(lenient.status, 0, `non-strict gate should exit 0: ${lenient.stderr}`);
  assert.match(lenient.stderr, /\[verdict\]\s+BLOCK/, lenient.stderr);

  // --strict: BLOCK → 종료 코드 4.
  const strict = runGateCli(ws.cwd, ["--strict"]);
  assert.equal(strict.status, 4, `strict gate on BLOCK should exit 4: ${strict.stderr}`);
});

test("gate --strict CLI: PASS_WITH_WARNINGS exits 3", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await writeLastDiff(
    ws.cwd,
    diffLines(
      "diff --git a/src/foo.ts b/src/foo.ts",
      "@@ -1 +1 @@",
      "-export const x = 1;",
      "+export const x = 2;"
    )
  );
  const strict = runGateCli(ws.cwd, ["--strict"]);
  assert.equal(
    strict.status,
    3,
    `strict gate on PASS_WITH_WARNINGS should exit 3: ${strict.stderr}`
  );
});
