/** 룰 정확성과 관련된 eval-case kind — P2 experience 참조로 유효한 종류. */
export const RULE_RELATED_KINDS: ReadonlySet<string> = new Set([
  "false_positive",
  "false_negative",
  "missed_risk",
  "noisy_rule",
  "useful_rule"
]);

/** eval-case 를 id 로 읽는 주입형 reader(테스트/실파일 양립). 없으면 null. */
export type EvalCaseReader = (id: string) => Promise<{ kind: string } | null>;

export interface ExperienceCheck {
  ok: boolean;
  reason?: string;
}

/** 참조한 eval-case 들이 실재하고 룰 관련 kind 인지 검증(provenance 위조 차단). */
export async function validateExperiences(
  ids: readonly string[],
  readEvalCase: EvalCaseReader
): Promise<ExperienceCheck> {
  for (const id of ids) {
    const ec = await readEvalCase(id);
    if (!ec) {
      return { ok: false, reason: `eval-case "${id}" 없음 — memory add 로 먼저 기록` };
    }
    if (!RULE_RELATED_KINDS.has(ec.kind)) {
      return {
        ok: false,
        reason: `eval-case "${id}" kind="${ec.kind}" 는 룰 관련 경험이 아님(유효: ${[...RULE_RELATED_KINDS].join(", ")})`
      };
    }
  }
  return { ok: true };
}
