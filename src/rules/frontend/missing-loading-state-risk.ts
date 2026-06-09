/**
 * frontend-accessibility rule: missing-loading-state-risk.
 *
 * tsx/jsx 에서 비동기 데이터 fetch(await fetch / .then() 체인 / axios / useQuery /
 * useEffect)가 추가됐는데 같은 파일에 loading state(isLoading / setLoading /
 * { loading } 구조분해 / useState<boolean>) 표현이 없으면 info.
 *
 * 휴리스틱이라 false positive 가능 — info 등급. comment 안의 단어 "loading" 은
 * 실제 state 가 아니므로 가드로 인정하지 않는다(state 형태만 인정).
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-loading-state-risk";
// await fetch / 일반 fetch() / .then 체인 / axios / useQuery / useEffect.
const FETCH_RE = /\b(fetch\s*\(|axios\.|useQuery|useEffect\()/;
// loading state 형태만 인정: 식별자/세터/구조분해/useState<boolean>.
// 주석 속 단어 "loading" 은 [,{]·[:=,}] 인접이 없어 매칭되지 않는다.
const LOADING_RE =
  /\b(isLoading|isFetching|isPending|setLoading|setIsLoading)\b|useState<\s*boolean|[,{]\s*loading\b|\bloading\s*[:=,}]/;

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
