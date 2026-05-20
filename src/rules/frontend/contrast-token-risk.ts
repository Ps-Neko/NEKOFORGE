/**
 * frontend-accessibility rule: contrast-token-risk.
 *
 * CSS/SCSS 에서 #fff/#ffffff/#000/#000000 같은 양 극단 색이 token 없이 사용 시
 * info 알림. 흰색-검정 contrast 자체는 OK 지만, 디자인 시스템 token (e.g., var)
 * 우회는 알릴 가치.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "contrast-token-risk";
const EXTREME_COLOR_RE = /#(fff|ffffff|000|000000)\b/i;
const VAR_RE = /var\(--/;

export const contrastTokenRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "흰색/검정 직접 사용 + CSS variable 부재 (info)",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(css|scss|sass)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (EXTREME_COLOR_RE.test(line) && !VAR_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "info",
              "extreme color (#fff / #000) without CSS variable",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
