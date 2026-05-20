/**
 * docs-quality rule (Phase RP-2 후속): stale-count-risk.
 *
 * README/RELEASE-NOTES 안의 "N tests", "N fixture" 같은 수치 표현 + 본 변경이
 * tests/ 또는 fixtures/ 추가/삭제를 동반하지만 README 의 해당 수치가 갱신되지
 * 않은 경우.
 *
 * 휴리스틱:
 * - diff 안에 tests/**.test.ts 또는 fixtures/* 추가/삭제 발견.
 * - diff 안에 README.md 변경 없음.
 * - warning 발화 (사용자가 의도적으로 갱신 지연했을 수도 있어 high 아님).
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "stale-count-risk";

const TEST_FILE_RE = /(^|\/)(tests?|spec|__tests__)\/.*\.(test|spec)\./;
const FIXTURE_FILE_RE = /(^|\/)fixtures\//;
const README_RE = /(^|\/)README\.md$/i;

export const staleCountRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "tests/fixtures 변경 + README 수치 미갱신 의심",
  async run(ctx) {
    let touchedTestsOrFixtures = false;
    let touchedReadme = false;
    for (const f of ctx.diff.files) {
      if (TEST_FILE_RE.test(f.path) || FIXTURE_FILE_RE.test(f.path)) {
        touchedTestsOrFixtures = true;
      }
      if (README_RE.test(f.path)) {
        touchedReadme = true;
      }
    }
    if (touchedTestsOrFixtures && !touchedReadme) {
      // info 등급 — verdict 영향 없음. README 의 stale count 가 흔하지만
      // 사용자가 의도적으로 batch 갱신할 수도 있음.
      return [
        makeFinding(
          RULE_ID,
          "info",
          "tests/fixtures changed but README.md untouched (count drift risk)"
        )
      ];
    }
    return [] as RuleFinding[];
  }
};
