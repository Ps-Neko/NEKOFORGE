/**
 * design rule (Phase QF): design-token-violation.
 *
 * 하드코딩된 색상 코드 / 직접 px·rem 값을 인라인 스타일에서 사용 시 경고.
 * 디자인 토큰 시스템을 우회하는 패턴.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "design-token-violation";

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_COLOR_RE = /\brgba?\(\s*\d+/;
const INLINE_PX_RE = /\b\d{2,}px\b/; // 두 자릿수 이상 px (1~9px 는 무시)

const STYLE_CONTEXT_RE = /style=\{|className=|className="|\.(scss|css)$/;

export const designTokenViolationRule: DeterministicRule = {
  id: RULE_ID,
  describe: "하드코딩 색상 / px 값이 디자인 토큰 우회",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx|css|scss|html)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        const inStyleContext =
          STYLE_CONTEXT_RE.test(line) || /\.(css|scss)$/.test(f.path);
        if (!inStyleContext) return;
        if (HEX_COLOR_RE.test(line) || RGB_COLOR_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "hardcoded color (use design token)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
        if (INLINE_PX_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "hardcoded px value (use spacing token)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
