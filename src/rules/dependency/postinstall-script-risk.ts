/**
 * dependency-risk rule: postinstall-script-risk.
 *
 * 별도 rule 로 분리 (hook-injection-risk 와 중복되지만 dependency-risk pack 의
 * 1차 시민). package.json 의 postinstall/preinstall/prepare 스크립트 추가 감지.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "postinstall-script-risk";

const LIFECYCLE_SCRIPT_RE =
  /"(postinstall|preinstall|prepare|prepublish)":/;

export const postinstallScriptRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json lifecycle script (postinstall 등) 추가",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/(^|\/)package\.json$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (LIFECYCLE_SCRIPT_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "package.json lifecycle script added (post/pre install/prepare)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
