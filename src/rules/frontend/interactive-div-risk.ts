/**
 * frontend-accessibility rule: interactive-div-risk.
 *
 * accessibility-risk 와 별개로 명시 — div onClick + role 없음 패턴.
 * 본 rule 은 accessibility-risk 와 중복 발화 가능 (의도된 다층 신호).
 *
 * 멀티라인 JSX 지원: 여러 줄로 쪼개진 여는 태그(<div ... onClick=... >)도
 * 태그 블록을 결합해 탐지하며, finding line 은 태그가 열린(<div/<span) 줄에 귀속한다.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "interactive-div-risk";

// div 핸들러: 포인터/터치 포함. (?<!-) 로 data-onClick 등 prefix 오탐 방지.
const DIV_HANDLER_RE =
  /(?<![\w-])(onClick|onKeyDown|onMouseDown|onPointerDown|onTouchStart)\s*=/;
// span 핸들러: 기존 계약 유지 (onClick/onKeyDown 만).
const SPAN_HANDLER_RE = /(?<![\w-])(onClick|onKeyDown)\s*=/;
const ROLE_RE = /(?<![\w-])role\s*=/;
const DIV_OPEN_RE = /<div\b/i;
const SPAN_OPEN_RE = /<span\b/i;

/**
 * 한 줄에서 line-comment 와 블록 comment 구간을 제거(잘라낸다).
 * 문자열 리터럴 내부의 슬래시를 comment 로 오인하지 않도록 단순 따옴표 추적.
 */
function stripComments(line: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    const next = line[i + 1];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") break; // line comment → 나머지 버림
    if (c === "/" && next === "*") {
      // 블록 comment → 닫힐 때까지 스킵 (같은 줄에 닫히면 이어서)
      const close = line.indexOf("*/", i + 2);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    out += c;
  }
  return out;
}

interface Tag {
  startLine: number; // 1-based index within addedLines
  attrs: string; // 여는 태그의 속성 영역 텍스트 (< ... > 직전까지)
  kind: "div" | "span";
}

/**
 * added 라인들을 결합해 <div>/<span> 여는 태그 블록을 추출한다.
 * 멀티라인 태그(`<div\n  onClick=...\n>`)도 한 블록으로 묶고, startLine 은
 * `<div`/`<span` 이 등장한 원본 줄(1-based)로 귀속한다.
 */
function collectOpenTags(lines: string[]): Tag[] {
  const tags: Tag[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripComments(lines[i]!);
    let kind: "div" | "span" | null = null;
    let m: RegExpMatchArray | null = null;
    const divM = cleaned.match(DIV_OPEN_RE);
    const spanM = cleaned.match(SPAN_OPEN_RE);
    if (divM && (!spanM || (divM.index ?? 0) <= (spanM.index ?? 0))) {
      kind = "div";
      m = divM;
    } else if (spanM) {
      kind = "span";
      m = spanM;
    }
    if (!kind || !m) continue;
    // 여는 태그의 속성 영역을 모은다: '<div' 이후부터 '>' 가 나올 때까지.
    let attrs = cleaned.slice((m.index ?? 0) + m[0].length);
    let gt = attrs.indexOf(">");
    let j = i;
    while (gt === -1 && j + 1 < lines.length) {
      j += 1;
      const more = stripComments(lines[j]!);
      attrs += "\n" + more;
      gt = attrs.indexOf(">");
    }
    if (gt !== -1) attrs = attrs.slice(0, gt);
    tags.push({ startLine: i + 1, attrs, kind });
  }
  return tags;
}

export const interactiveDivRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "<div>/<span> 가 interactive handler 만 가지고 role 미명시",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx|html)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      for (const tag of collectOpenTags(f.addedLines)) {
        const handlerRe = tag.kind === "div" ? DIV_HANDLER_RE : SPAN_HANDLER_RE;
        if (handlerRe.test(tag.attrs) && !ROLE_RE.test(tag.attrs)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "interactive div/span without role attribute (use <button> or role)",
              { file: f.path, line: tag.startLine }
            )
          );
        }
      }
    }
    return findings;
  }
};
