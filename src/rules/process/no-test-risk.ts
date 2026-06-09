/**
 * SECURITY.md §3.4 — 기능 변경 vs 테스트 무변경.
 * 정책 testFirst=true 일 때 등급 격상.
 */
import type { DeterministicRule } from "../types.js";
import { makeFinding } from "../types.js";
import { isCodeFile } from "../../utils/language.js";

const RULE_ID = "no-test-risk";

const TEST_PATH_RE =
  /(^|\/)tests?\/|(\.test\.|_test\.|\.spec\.)[tj]sx?$|(^|\/)test_[^/]+\.py$|_test\.py$|_test\.go$/;
const CODE_SRC_PATH_RE = /^(src|lib|app|internal|pkg|cmd)\//;
const DOC_PATH_RE = /^(docs?\/|README|CHANGELOG)/i;
const LOCK_RE =
  /package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|Pipfile\.lock$|poetry\.lock$|go\.sum$/;
// 생성물: 손으로 테스트를 작성할 대상이 아니다 (FP 방지).
const GENERATED_PATH_RE =
  /(^|\/)(generated|__generated__|gen)\/|\.(gen|generated)\.[tj]sx?$|\.g\.[tj]sx?$|_pb2?\.py$|\.pb\.go$/;

function isOnlyImportShuffle(addedLines: string[], deletedLines: string[]): boolean {
  const trim = (lines: string[]) =>
    lines.filter((l) => l.trim() !== "" && !l.trim().startsWith("//"));
  const onlyImports = (lines: string[]) =>
    trim(lines).every(
      (l) =>
        /^\s*import\s/.test(l) ||
        /^\s*from\s/.test(l) ||
        /^\s*use\s/.test(l)
    );
  return onlyImports(addedLines) && onlyImports(deletedLines);
}

function isProductionCodePath(path: string): boolean {
  if (TEST_PATH_RE.test(path)) return false;
  if (DOC_PATH_RE.test(path)) return false;
  if (LOCK_RE.test(path)) return false;
  if (GENERATED_PATH_RE.test(path)) return false;
  // 통상 src 디렉터리 또는 흔한 패키지 루트.
  if (CODE_SRC_PATH_RE.test(path)) return true;
  // 디렉터리가 src/ 아닌데도 코드 확장자라면 (Go 의 패키지 디렉터리 등) 보수적으로 포함.
  return isCodeFile(path);
}

// 실제 단언/테스트 호출 토큰. 하나라도 있으면 "내용 있는" 테스트로 본다.
const TEST_TOKEN_RE =
  /\b(assert|expect|should|t\.Run\(|t\.Error|t\.Fatal|require\.)\b|(^|[^.\w])(test|it)\s*\(|def\s+test_/;
// skip/비활성 마커 (공백 허용). 이 마커가 있는 라인은 내용으로 인정하지 않는다.
const DISABLED_LINE_RE =
  /\.skip\s*\(|\bx(it|describe)\s*\(|pytest\.mark\.skip|@unittest\.skip|@(Disabled|Ignore)\b|\bt\.Skip(Now)?\s*\(/;

/**
 * 추가된 test 파일이 실제 단언/내용을 담고 있는지 약하게 확인한다.
 * 빈 파일 / 주석-only / .skip-only 면 테스트 변경으로 인정하지 않는다 (게이트 우회 방지).
 * 과교정 주의: 토큰이 하나라도 있고 그 라인이 disabled 가 아니면 인정한다.
 */
function hasSubstantiveTest(addedLines: string[]): boolean {
  for (const raw of addedLines) {
    const l = raw.trim();
    if (l === "") continue;
    if (l.startsWith("//") || l.startsWith("#") || l.startsWith("*") || l.startsWith("/*")) {
      continue;
    }
    if (DISABLED_LINE_RE.test(l)) continue;
    if (TEST_TOKEN_RE.test(l)) return true;
  }
  return false;
}

export const noTestRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "src 변경이 있는데 tests 변경이 없을 때 경고",
  async run(ctx) {
    const srcChanges = ctx.diff.files.filter(
      (f) =>
        isProductionCodePath(f.path) &&
        !isOnlyImportShuffle(f.addedLines, f.deletedLines)
    );
    // 테스트 변경으로 인정하려면 실제 내용이 있어야 한다 (빈/주석/.skip-only 우회 방지).
    // 삭제/이름변경(테스트 이동)은 추가라인이 없어도 정당한 변경으로 인정한다.
    const testChanges = ctx.diff.files.filter((f) => {
      if (!TEST_PATH_RE.test(f.path)) return false;
      if (f.status === "deleted" || f.status === "renamed") return true;
      return hasSubstantiveTest(f.addedLines);
    });

    if (srcChanges.length === 0 || testChanges.length > 0) {
      return [];
    }

    const severity = ctx.policies?.testFirst ? "high" : "warning";
    return [
      makeFinding(
        RULE_ID,
        severity,
        `src changed but no tests changed (${srcChanges.length} src files)`,
        srcChanges[0] ? { file: srcChanges[0].path } : {}
      )
    ];
  }
};
