/**
 * design rule (Phase QF): accessibility-risk.
 *
 * JSX/TSX/HTML 에서 의미적 a11y 누락 패턴 검출.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "accessibility-risk";

const IMG_NO_ALT_RE = /<img\b(?![^>]*\balt\s*=)/i;
const BUTTON_EMPTY_RE = /<button\b[^>]*>\s*<\/button>/i;
const DIV_ONCLICK_NO_ROLE_RE = /<div\b(?=[^>]*\bonClick)(?![^>]*\brole\s*=)/i;
const ANCHOR_NO_HREF_RE = /<a\b(?![^>]*\bhref\s*=)/i;
const INPUT_NO_LABEL_RE = /<input\b(?![^>]*\baria-label\s*=)(?![^>]*\bid\s*=)/i;

export const accessibilityRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "a11y 위반 패턴 (img/button/div onClick/a href/input label) 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx|html)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (IMG_NO_ALT_RE.test(line)) {
          findings.push(
            makeFinding(RULE_ID, "high", "<img> without alt", {
              file: f.path,
              line: idx + 1
            })
          );
        }
        if (BUTTON_EMPTY_RE.test(line)) {
          findings.push(
            makeFinding(RULE_ID, "warning", "<button> empty (no label)", {
              file: f.path,
              line: idx + 1
            })
          );
        }
        if (DIV_ONCLICK_NO_ROLE_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "<div onClick> without role attribute",
              { file: f.path, line: idx + 1 }
            )
          );
        }
        if (ANCHOR_NO_HREF_RE.test(line)) {
          findings.push(
            makeFinding(RULE_ID, "warning", "<a> without href", {
              file: f.path,
              line: idx + 1
            })
          );
        }
        if (INPUT_NO_LABEL_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "<input> without aria-label or id binding",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
