/**
 * SECURITY.md §3.4 — 기능 변경 vs 테스트 무변경.
 * 정책 testFirst=true 일 때 등급 격상.
 */
import type { DeterministicRule } from "./types.js";
import { makeFinding } from "./types.js";
import { isCodeFile } from "../utils/language.js";

const RULE_ID = "no-test-risk";

const TEST_PATH_RE =
  /(^|\/)tests?\/|(\.test\.|_test\.|\.spec\.)[tj]sx?$|(^|\/)test_[^/]+\.py$|_test\.py$|_test\.go$/;
const CODE_SRC_PATH_RE = /^(src|lib|app|internal|pkg|cmd)\//;
const DOC_PATH_RE = /^(docs?\/|README|CHANGELOG)/i;
const LOCK_RE =
  /package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|Pipfile\.lock$|poetry\.lock$|go\.sum$/;

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
  // 통상 src 디렉터리 또는 흔한 패키지 루트.
  if (CODE_SRC_PATH_RE.test(path)) return true;
  // 디렉터리가 src/ 아닌데도 코드 확장자라면 (Go 의 패키지 디렉터리 등) 보수적으로 포함.
  return isCodeFile(path);
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
    const testChanges = ctx.diff.files.filter((f) => TEST_PATH_RE.test(f.path));

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
