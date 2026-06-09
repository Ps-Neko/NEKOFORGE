/**
 * frontend-accessibility rule: missing-focus-state-risk.
 *
 * CSS/SCSS 의 added 라인에서 `:hover` 가 추가됐는데 같은 셀렉터에 `:focus`
 * (또는 `:focus-visible`) 가 없으면 warning. 키보드 네비게이션을 잃는 흔한 패턴.
 *
 * 셀렉터 단위 매칭(간단 휴리스틱): `.btn:hover` 는 `.btn:focus` 로만 충족되고,
 * 무관한 `.link:focus` 가 파일 전역으로 억제하지 않는다(FN 방지). 매칭 기준은
 * 의사클래스 바로 앞에 붙은 compound 셀렉터(`[.#\w-]+`).
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-focus-state-risk";
const HOVER_G_RE = /([.#\w-]*):hover\b/g;
const FOCUS_G_RE = /([.#\w-]*):focus(?:-visible)?\b/g;

/** 라인에서 `:hover`/`:focus` 에 바로 붙은 compound 셀렉터 base 집합을 뽑는다. */
function basesOf(lines: string[], re: RegExp): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      out.add(m[1] ?? "");
    }
  }
  return out;
}

export const missingFocusStateRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: ":hover 추가 + :focus 부재",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(css|scss|sass)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const focusBases = basesOf(f.addedLines, FOCUS_G_RE);
      // 첫 번째로 매칭되는 focus 가 없는 :hover 셀렉터의 라인을 보고.
      for (let idx = 0; idx < f.addedLines.length; idx++) {
        const line = f.addedLines[idx]!;
        HOVER_G_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        let unmatched = false;
        while ((m = HOVER_G_RE.exec(line)) !== null) {
          const base = m[1] ?? "";
          if (!focusBases.has(base)) {
            unmatched = true;
            break;
          }
        }
        if (unmatched) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              ":hover added without :focus or :focus-visible (keyboard nav loss)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      }
    }
    return findings;
  }
};
