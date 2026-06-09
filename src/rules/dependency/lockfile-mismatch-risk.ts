/**
 * dependency-risk rule: lockfile-mismatch-risk.
 *
 * package.json 변경 + 같은 diff 에 lockfile (package-lock.json / yarn.lock /
 * pnpm-lock.yaml) 변경 부재.
 */
import type { DeterministicRule } from "../types.js";
import { makeFinding } from "../types.js";
import { sectionStates, inDepsSection } from "./_section.js";

const RULE_ID = "lockfile-mismatch-risk";
const PKG_RE = /(^|\/)package\.json$/;
const LOCK_RE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;

/**
 * dependency 라인의 *key* 패턴. value 패턴은 DEP_VALUE_RE 가 따로 본다.
 * 최상위 메타 key (version/name/description 등) 는 dependency 가 아니므로 제외해
 * version bump FP 를 막는다.
 */
const DEP_KEY_RE = /^\s*"(?!(?:version|name|description|license|author|type|main|module|types|typings|homepage|bugs|funding|keywords|private|sideEffects|packageManager)")[a-zA-Z@][^"]*"\s*:\s*/;

/**
 * dependency value 패턴 — 기존 숫자/caret/tilde/star/latest 에 더해
 * git+/github:/npm:/file:/workspace:/link:/tarball(https tgz) alias 추가(gap 2 FN).
 */
const DEP_VALUE_RE =
  /:\s*"(?:[\^~]?\d|\*|latest|(?:git\+|git:|github:|npm:|file:|link:|workspace:|portal:)|https?:\/\/[^"]+\.(?:tgz|tar\.gz))/;

export const lockfileMismatchRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json 변경 + lockfile 미변경",
  async run(ctx) {
    const touchedPkg = ctx.diff.files.some((f) => PKG_RE.test(f.path));
    if (!touchedPkg) return [];
    // dependencies/devDependencies 변경이 있는지 (단순 version bump / scripts 변경 제외).
    const pkgFile = ctx.diff.files.find((f) => PKG_RE.test(f.path));
    if (!pkgFile) return [];
    const states = sectionStates(pkgFile.addedLines);
    const depChange = pkgFile.addedLines.some((l, idx) => {
      // 명시적 비-dependency 섹션(scripts/publishConfig 등) 안쪽은 제외(gap 1 FP).
      if (!inDepsSection(states[idx] ?? "unknown")) return false;
      if (!DEP_KEY_RE.test(l)) return false;
      return DEP_VALUE_RE.test(l);
    });
    if (!depChange) return [];
    const touchedLock = ctx.diff.files.some((f) => LOCK_RE.test(f.path));
    if (!touchedLock) {
      return [
        makeFinding(
          RULE_ID,
          "warning",
          "package.json dependency added but lockfile (package-lock/yarn.lock/pnpm-lock) untouched"
        )
      ];
    }
    return [];
  }
};
