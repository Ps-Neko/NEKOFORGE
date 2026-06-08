/**
 * 셸/노드 버전과 무관한 테스트 러너.
 *
 * 이유: `node --test --import tsx "tests/** /*.test.ts"` 는 글롭 확장을 셸 또는
 * 노드 버전에 의존한다. POSIX sh(dash, globstar OFF)는 `**` 를 한 단계로 축소해
 * depth-3 파일만 매칭 → CI 가 86개 중 27개만 돌리고도 green 이 됐다(해자 누락).
 * 여기서는 디스커버리를 직접 fs 재귀로 수행해 그 버그 클래스를 원천 제거한다.
 *
 * 0개를 찾으면 조용히 통과하지 않고 비정상 종료한다(silent-green 방지).
 */
import { readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * rootDir 아래의 모든 `*.test.ts` 절대경로를 재귀로 수집한다(정렬됨).
 * @param {string} rootDir
 * @returns {string[]}
 */
export function collectTestFiles(rootDir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const full = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out.sort();
}

function main() {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptsDir, "..");
  const testsDir = join(repoRoot, "tests");

  const files = collectTestFiles(testsDir);
  if (files.length === 0) {
    console.error(
      `run-tests: no *.test.ts files found under ${testsDir} — refusing to report success on an empty test set.`
    );
    process.exit(1);
  }

  const passthrough = process.argv.slice(2);
  const result = spawnSync(
    process.execPath,
    ["--test", "--import", "tsx", ...passthrough, ...files],
    { stdio: "inherit" }
  );
  if (result.error) {
    console.error(`run-tests: failed to spawn node --test: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

// 직접 실행될 때만 테스트를 돌린다(import 시에는 collectTestFiles 만 노출).
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
