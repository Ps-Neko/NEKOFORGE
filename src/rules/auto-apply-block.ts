/**
 * SECURITY.md §3.8 — BLOCK / INSUFFICIENT_EVIDENCE 에서 apply 시도 차단 (v3 변경 없음).
 *
 * 다른 rule 들과 달리 본 rule 은 diff 가 아니라 verdict 를 본다.
 * apply 모듈은 진입 시점에 `evaluateAutoApplyBlock(verdict)` 를 호출한다.
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "auto-apply-block";

const BLOCKING_VERDICTS = new Set(["BLOCK", "INSUFFICIENT_EVIDENCE"]);

export interface AutoApplyBlockInput {
  verdict: string;
  humanApproved?: boolean;
}

export class AutoApplyBlockedError extends Error {
  readonly exitCode = 4;
  readonly verdict: string;
  constructor(verdict: string) {
    super(`apply blocked: verdict=${verdict}`);
    this.name = "AutoApplyBlockedError";
    this.verdict = verdict;
  }
}

export function evaluateAutoApplyBlock(input: AutoApplyBlockInput): void {
  if (BLOCKING_VERDICTS.has(input.verdict)) {
    throw new AutoApplyBlockedError(input.verdict);
  }
}

/**
 * gate 단계에서 다른 rule 들 사이에 끼워 호출되는 형태도 지원한다.
 * RuleContext 에 testStatus 또는 highRiskFlags 만 보고는 verdict 를 결정할 수 없으므로,
 * 본 rule 의 finding 산출은 보조적이다. (실제 차단은 evaluateAutoApplyBlock.)
 */
export const autoApplyBlockRule: DeterministicRule = {
  id: RULE_ID,
  describe: "BLOCK/INSUFFICIENT_EVIDENCE 상태에서 apply 차단",
  async run(_ctx): Promise<RuleFinding[]> {
    return [
      makeFinding(
        RULE_ID,
        "info",
        "auto-apply-block is enforced at apply entry, not at gate"
      )
    ];
  }
};
