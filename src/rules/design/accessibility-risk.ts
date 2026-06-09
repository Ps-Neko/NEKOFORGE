/**
 * design rule (Phase QF): accessibility-risk.
 *
 * JSX/TSX/HTML 에서 의미적 a11y 누락 패턴 검출.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "accessibility-risk";

const IMG_OPEN_RE = /<img\b/i;
const IMG_NO_ALT_RE = /<img\b(?![^>]*\balt\s*=)/i;
const BUTTON_EMPTY_RE = /<button\b[^>]*>\s*<\/button>/i;

// `<img` 가 같은 줄에서 닫히지 않으면(멀티라인 태그) 닫는 `>` 까지의 전체 태그
// 텍스트를 모아 alt 유무를 판정한다. alt 가 뒷줄에 있을 때의 FP(GAP5)를 막는다.
function imgTagSpan(lines: string[], startIdx: number): string {
  let span = lines[startIdx] ?? "";
  if (span.includes(">")) return span; // 한 줄에서 닫힘 — 단일 라인 처리.
  for (let i = startIdx + 1; i < lines.length && i < startIdx + 25; i++) {
    const next = lines[i] ?? "";
    span += "\n" + next;
    if (next.includes(">")) break;
  }
  return span;
}
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
        if (IMG_OPEN_RE.test(line)) {
          const span = imgTagSpan(f.addedLines, idx);
          if (IMG_NO_ALT_RE.test(span)) {
            findings.push(
              makeFinding(RULE_ID, "high", "<img> without alt", {
                file: f.path,
                line: idx + 1
              })
            );
          }
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
