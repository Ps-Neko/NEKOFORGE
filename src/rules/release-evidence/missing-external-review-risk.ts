/**
 * release-evidence rule: missing-external-review-risk.
 *
 * release mode 의 gate 가 호출됐는데 .review-requests/<topic>.response.md
 * 가 없는 경우 — release-strict pack 의 보조 신호.
 *
 * 본 rule 은 ctx.diff 가 아니라 ctx.mode 와 file system 을 봐야 하지만,
 * deterministic rule interface 는 diff 만 본다. 따라서 휴리스틱:
 * release-notes 의 added 라인에 "external review" / "codex review" 키워드
 * 부재 시 info.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-external-review-risk";
const RELEASE_NOTES_RE = /(^|\/)RELEASE-NOTES\.md$/i;
const EXTERNAL_REVIEW_KEYWORD_RE = /(external review|codex review|self-review|external-validation)/i;
const VERSION_BUMP_RE = /v\d+\.\d+\.\d+|##\s*v?\d/;

export const missingExternalReviewRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "RELEASE-NOTES 버전 추가 + external review 흔적 부재",
  async run(ctx) {
    const releaseFile = ctx.diff.files.find((f) =>
      RELEASE_NOTES_RE.test(f.path)
    );
    if (!releaseFile) return [];
    const hasVersionBump = releaseFile.addedLines.some((l) => VERSION_BUMP_RE.test(l));
    if (!hasVersionBump) return [];
    const hasExternalReview = releaseFile.addedLines.some((l) =>
      EXTERNAL_REVIEW_KEYWORD_RE.test(l)
    );
    if (!hasExternalReview) {
      return [
        makeFinding(
          RULE_ID,
          "info",
          "version bump in RELEASE-NOTES but no external review/codex/self-review mention"
        )
      ];
    }
    return [] as RuleFinding[];
  }
};
