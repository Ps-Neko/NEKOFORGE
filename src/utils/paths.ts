/**
 * `.harness/` 경로 헬퍼. 다른 모듈은 본 헬퍼만 사용한다.
 */
import { resolve, join, isAbsolute, dirname, sep } from "node:path";
import { realpathSync } from "node:fs";

const HARNESS_DIR = ".harness";

function workspaceRoot(cwd: string = process.cwd()): string {
  return resolve(cwd);
}

export function harnessRoot(cwd: string = process.cwd()): string {
  return join(workspaceRoot(cwd), HARNESS_DIR);
}

export function withinHarness(
  absolutePath: string,
  cwd: string = process.cwd()
): boolean {
  const root = harnessRoot(cwd);
  const abs = isAbsolute(absolutePath) ? absolutePath : resolve(cwd, absolutePath);
  return abs === root || abs.startsWith(root + "/") || abs.startsWith(root + "\\");
}

function tryRealpath(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * 심볼릭 링크/정션까지 해소한 실제 경로가 .harness/ 안에 있는지 검사한다.
 *
 * withinHarness 의 문자열 검사는 `.harness/escape` 같은 경로가 *문자열상* 안에 있으면
 * 통과시키지만, 그 escape 가 루트 밖을 가리키는 링크면 그 링크를 통해 외부에
 * 읽기/쓰기가 일어난다. 여기서는 대상의 "존재하는 최심 조상"을 realpath 로 해소해
 * 실제 위치가 .harness/ 안인지 확인한다(아직 만들어지지 않은 tail 은 링크일 수 없다).
 *
 * .harness/ 가 아직 없으면(init 전) 평가할 링크가 없으므로 문자열 검사로 위임한다.
 */
export function realWithinHarness(
  absolutePath: string,
  cwd: string = process.cwd()
): boolean {
  const realRoot = tryRealpath(harnessRoot(cwd));
  if (realRoot === null) {
    return withinHarness(absolutePath, cwd);
  }
  let cur = resolve(
    isAbsolute(absolutePath) ? absolutePath : join(cwd, absolutePath)
  );
  for (;;) {
    const real = tryRealpath(cur);
    if (real !== null) {
      return real === realRoot || real.startsWith(realRoot + sep);
    }
    const parent = dirname(cur);
    if (parent === cur) return false; // fs 루트까지 갔는데 실존 조상 없음
    cur = parent;
  }
}
