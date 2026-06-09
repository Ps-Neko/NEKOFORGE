/**
 * frontend-accessibility rule: contrast-token-risk.
 *
 * CSS/SCSS 에서 #fff/#ffffff/#000/#000000 같은 양 극단 색(흰색/검정)이 token 없이
 * 사용되면 info 알림. 흰색-검정 대비 자체는 OK 지만, 디자인 시스템 token (var(--…))
 * 우회는 알릴 가치.
 *
 * 색 커버리지: hex(3/4/6/8 자리, alpha 포함) + rgb()/rgba() + hsl()/hsla() 의
 * 순수 흰색·검정. var() fallback 안의 색과, custom-property 정의 라인은 token
 * 그 자체이므로 억제한다(같은 색 token 일 때만 억제).
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "contrast-token-risk";

// extreme hex: #fff #000 (3), #ffff #000f (4, alpha), #ffffff #000000 (6),
// #ffffffff #000000ff (8, alpha). alpha 자리(f|0) 는 흰/검 양극단만 다룬다.
const EXTREME_HEX_RE =
  /#(?:fff(?:f)?|ffffff(?:ff)?|000(?:f|0)?|000000(?:ff|00)?)\b/i;

// rgb()/rgba() 순수 흰색(255,255,255) / 검정(0,0,0).
const RGB_WHITE_RE = /\brgba?\(\s*255\s*,\s*255\s*,\s*255\b/i;
const RGB_BLACK_RE = /\brgba?\(\s*0\s*,\s*0\s*,\s*0\b/i;

// hsl()/hsla() 순수 흰색(L=100%) / 검정(L=0%). hue/sat 무관, lightness 만 본다.
const HSL_WHITE_RE = /\bhsla?\([^)]*?,\s*\d{1,3}%\s*,\s*100%/i;
const HSL_BLACK_RE = /\bhsla?\([^)]*?,\s*\d{1,3}%\s*,\s*0%/i;

const ANY_EXTREME_RE = new RegExp(
  [
    EXTREME_HEX_RE.source,
    RGB_WHITE_RE.source,
    RGB_BLACK_RE.source,
    HSL_WHITE_RE.source,
    HSL_BLACK_RE.source
  ].join("|"),
  "i"
);

// custom-property 정의 라인(`--token: <color>`): token 그 자체라 우회 아님.
const CUSTOM_PROP_DEF_RE = /(?:^|[;{]|\*\/)\s*--[\w-]+\s*:/;

/**
 * 라인에서 var(...) fallback 구간을 제거한 잔여 텍스트를 돌려준다.
 * `var(--fg, #fff)` 의 `#fff` 는 token fallback(같은 색 token)이므로 억제 대상.
 * 잔여 텍스트에 남은 extreme color 만 raw 우회로 본다.
 */
function stripVarFallbacks(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const m = rest.match(/\bvar\(\s*--/);
    if (!m || m.index === undefined) {
      out += rest;
      break;
    }
    out += rest.slice(0, m.index);
    // 균형 잡힌 닫는 괄호까지 스킵.
    let depth = 0;
    let j = i + m.index;
    for (; j < line.length; j++) {
      if (line[j] === "(") depth++;
      else if (line[j] === ")") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    i = j;
  }
  return out;
}

export const contrastTokenRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "흰색/검정 직접 사용 + CSS variable 부재 (info)",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(css|scss|sass)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        // custom-property 정의 라인은 token 정의이므로 제외.
        if (CUSTOM_PROP_DEF_RE.test(line)) return;
        // var() fallback 안의 색은 같은 색 token 사용이므로 제거 후 잔여만 검사.
        const residual = stripVarFallbacks(line);
        if (ANY_EXTREME_RE.test(residual)) {
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
