/**
 * dependency-risk rule (Phase RP-2): unbounded-version-risk.
 *
 * package.json 의 dependencies/devDependencies 에 `"*"` 또는 `">=X"` 형태 추가 시 경고.
 * caret(`^`) 와 tilde(`~`) 는 일반 관행이므로 미발화.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "unbounded-version-risk";

const UNBOUNDED_RE = /"(?:\*|>=?\s*\d+|<=?\s*\d+|x|latest)"/;
const DEP_LINE_RE = /^\s*"[a-zA-Z@][^"]*":\s*"[^"]+"/;

export const unboundedVersionRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json 에 unbounded version (*, >=, latest) 추가 시 경고",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/(^|\/)package\.json$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (!DEP_LINE_RE.test(line)) return;
        if (UNBOUNDED_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "unbounded dependency version (*, >=, latest)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
