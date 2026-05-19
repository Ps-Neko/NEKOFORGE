/**
 * design rule (Phase QF): responsive-break-risk.
 *
 * 고정 width / max-width 가 미디어 쿼리 없이 추가될 때 경고.
 * 반응형 레이아웃 누락 위험.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "responsive-break-risk";

const FIXED_WIDTH_RE = /\bwidth\s*:\s*\d{3,}px/i;
const MAX_WIDTH_NONE_RE = /\bmax-width\s*:\s*none/i;
const HAS_MEDIA_QUERY = /@media\s+/;

export const responsiveBreakRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "미디어 쿼리 없는 고정 width 추가 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx|css|scss|html)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const allText = f.addedLines.join("\n");
      const hasMedia = HAS_MEDIA_QUERY.test(allText);
      f.addedLines.forEach((line, idx) => {
        if (FIXED_WIDTH_RE.test(line) && !hasMedia) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "fixed width without media query in same file",
              { file: f.path, line: idx + 1 }
            )
          );
        }
        if (MAX_WIDTH_NONE_RE.test(line)) {
          findings.push(
            makeFinding(RULE_ID, "warning", "max-width:none disables responsive bounds", {
              file: f.path,
              line: idx + 1
            })
          );
        }
      });
    }
    return findings;
  }
};
