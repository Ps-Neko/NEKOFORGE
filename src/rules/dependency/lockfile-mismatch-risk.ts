/**
 * dependency-risk rule: lockfile-mismatch-risk.
 *
 * package.json 변경 + 같은 diff 에 lockfile (package-lock.json / yarn.lock /
 * pnpm-lock.yaml) 변경 부재.
 */
import type { DeterministicRule } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "lockfile-mismatch-risk";
const PKG_RE = /(^|\/)package\.json$/;
const LOCK_RE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;

export const lockfileMismatchRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json 변경 + lockfile 미변경",
  async run(ctx) {
    const touchedPkg = ctx.diff.files.some((f) => PKG_RE.test(f.path));
    if (!touchedPkg) return [];
    // dependencies/devDependencies 변경이 있는지 (단순 version bump / scripts 변경 제외).
    const pkgFile = ctx.diff.files.find((f) => PKG_RE.test(f.path));
    if (!pkgFile) return [];
    const depChange = pkgFile.addedLines.some((l) =>
      /^\s*"[a-zA-Z@][^"]*":\s*"[\^~]?\d|"\*"|"latest"/.test(l)
    );
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
