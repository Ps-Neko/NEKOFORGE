/**
 * frontend-accessibility rule: missing-loading-state-risk.
 *
 * tsx/jsx 에서 await fetch / useEffect 사용 + 같은 파일에 loading state
 * (isLoading / loading / useState<boolean>) 표현 부재.
 *
 * 휴리스틱이라 false positive 가능 — info 등급.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-loading-state-risk";
const FETCH_RE = /\b(await\s+fetch\(|axios\.|useQuery|useEffect\()/;
const LOADING_RE = /\b(isLoading|loading|isFetching|isPending|useState<\s*boolean)/;

export const missingLoadingStateRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "async data fetch + loading state 표현 부재 (info)",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(tsx|jsx)$/i.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const added = f.addedLines.join("\n");
      if (FETCH_RE.test(added) && !LOADING_RE.test(added)) {
        findings.push(
          makeFinding(
            RULE_ID,
            "info",
            "async data fetch added without loading state representation",
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
