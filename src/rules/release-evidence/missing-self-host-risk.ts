/**
 * release-evidence rule: missing-self-host-risk.
 *
 * RELEASE-NOTES.md 또는 ROADMAP §통과 기록 갱신 + examples/phase-self-host-*
 * 디렉터리 추가 없음 → release 의지가 자가 검증 없이 진행.
 *
 * info 등급 — 정직성 신호일 뿐 verdict 강등 안 함.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-self-host-risk";

export const missingSelfHostRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "release-notes 변경 + self-host 흔적 없음 (info)",
  async run(ctx) {
    const touchedReleaseNotes = ctx.diff.files.some((f) =>
      /(^|\/)RELEASE-NOTES\.md$/i.test(f.path)
    );
    const touchedSelfHostDir = ctx.diff.files.some((f) =>
      /(^|\/)examples\/phase-self-host-/.test(f.path)
    );
    if (touchedReleaseNotes && !touchedSelfHostDir) {
      return [
        makeFinding(
          RULE_ID,
          "info",
          "RELEASE-NOTES.md changed but no examples/phase-self-host-*/ trace in same diff"
        )
      ];
    }
    return [] as RuleFinding[];
  }
};
