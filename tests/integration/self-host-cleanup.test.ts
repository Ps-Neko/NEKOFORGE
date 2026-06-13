/**
 * self-host 임시 워크스페이스 정리 회귀 테스트.
 *
 * mkdtemp(nekoforge-self-host-*) 가 성공 경로에서 삭제되지 않고 영구히 남던
 * 누수의 회귀 방지: 자식 프로세스의 os.tmpdir() 를 테스트 전용 디렉토리로
 * 돌려(win32: TEMP/TMP, POSIX: TMPDIR) self-host 를 실행한 뒤, 정상 종료
 * 후 임시 워크스페이스가 남지 않음을 확인한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../../..");
const cliPath = join(repoRoot, "src", "cli", "index.ts");

test("self-host: 정상 종료 후 nekoforge-self-host-* 임시 폴더가 삭제된다", async (t) => {
  const tmpRoot = await mkdtemp(join(tmpdir(), "vh-selfhost-tmp-"));
  t.after(async () => rm(tmpRoot, { recursive: true, force: true }));

  const r = spawnSync(process.execPath, ["--import", "tsx", cliPath, "self-host"], {
    encoding: "utf8",
    timeout: 60000,
    cwd: repoRoot,
    env: { ...process.env, TMPDIR: tmpRoot, TEMP: tmpRoot, TMP: tmpRoot }
  });

  assert.equal(r.status, 0, `self-host should exit 0: ${r.stderr}`);
  assert.match(r.stderr, /self-host complete/, r.stderr);
  // 경로 출력 대신 REPORT.md 본문이 콘솔에 실린다.
  assert.match(r.stderr, /\[report\] REPORT\.md:/, r.stderr);

  const leftovers = (await readdir(tmpRoot)).filter((n) =>
    n.startsWith("nekoforge-self-host-")
  );
  assert.deepEqual(
    leftovers,
    [],
    `임시 워크스페이스 누수: ${leftovers.join(", ")}`
  );
});
