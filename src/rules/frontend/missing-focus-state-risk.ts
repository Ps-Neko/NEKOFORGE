/**
 * frontend-accessibility rule: missing-focus-state-risk.
 *
 * CSS/SCSS 의 added 라인에 `:hover` 가 있는데 같은 파일에 `:focus` 가 없으면 warning.
 * 키보드 네비게이션을 잃어버리는 흔한 패턴.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-focus-state-risk";
const HOVER_RE = /:hover\b/;
const FOCUS_RE = /:focus(-visible)?\b/;

export const missingFocusStateRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: ":hover 추가 + :focus 부재",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(css|scss|sass)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const added = f.addedLines.join("\n");
      if (HOVER_RE.test(added) && !FOCUS_RE.test(added)) {
        const idx = f.addedLines.findIndex((l) => HOVER_RE.test(l));
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
    return findings;
  }
};
