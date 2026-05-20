/**
 * frontend-accessibility rule: interactive-div-risk.
 *
 * accessibility-risk 와 별개로 명시 — div onClick + role 없음 패턴.
 * 본 rule 은 accessibility-risk 와 중복 발화 가능 (의도된 다층 신호).
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "interactive-div-risk";

const DIV_INTERACTIVE_RE = /<div\b(?=[^>]*\b(onClick|onKeyDown|onMouseDown))(?![^>]*\brole\s*=)/i;
const SPAN_INTERACTIVE_RE = /<span\b(?=[^>]*\b(onClick|onKeyDown))(?![^>]*\brole\s*=)/i;

export const interactiveDivRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "<div>/<span> 가 interactive handler 만 가지고 role 미명시",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx|html)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (DIV_INTERACTIVE_RE.test(line) || SPAN_INTERACTIVE_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "interactive div/span without role attribute (use <button> or role)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
