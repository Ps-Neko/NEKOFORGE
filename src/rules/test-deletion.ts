/**
 * SECURITY.md §3.3 — 테스트 삭제 또는 skip 마커 추가.
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "test-deletion";

const TEST_PATH_RE = /(^|\/)tests?\//;
const TEST_FILE_RE =
  /(\.test\.|_test\.|\.spec\.)[tj]sx?$|(^|\/)test_[^/]+\.py$|_test\.py$|_test\.go$/;

const SKIP_MARKERS = [
  // TS/JS
  ".skip(",
  "xdescribe(",
  "xit(",
  "test.skip(",
  "it.skip(",
  // Python
  "pytest.mark.skip",
  "@pytest.mark.skip",
  "@unittest.skip",
  // Go
  "t.Skip(",
  "t.SkipNow(",
  "b.Skip(",
  // Java
  "@Disabled",
  "@Ignore"
];

function isTestPath(path: string): boolean {
  return TEST_PATH_RE.test(path) || TEST_FILE_RE.test(path);
}

export const testDeletionRule: DeterministicRule = {
  id: RULE_ID,
  describe: "테스트 파일 삭제 또는 skip 마커 신규 추가 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];

    for (const f of ctx.diff.files) {
      if (f.status === "deleted" && isTestPath(f.path)) {
        findings.push(
          makeFinding(
            RULE_ID,
            "critical",
            `test file deleted: ${f.path}`,
            { file: f.path }
          )
        );
        continue;
      }

      f.addedLines.forEach((line, idx) => {
        for (const marker of SKIP_MARKERS) {
          if (line.includes(marker)) {
            const wasPresent = f.deletedLines.some((d) => d.includes(marker));
            if (!wasPresent) {
              findings.push(
                makeFinding(
                  RULE_ID,
                  "high",
                  `skip marker added: ${marker}`,
                  { file: f.path, line: idx + 1 }
                )
              );
            }
          }
        }
      });

      if (f.status === "modified" && isTestPath(f.path)) {
        const delta = f.addedLines.length - f.deletedLines.length;
        if (delta < -20 && f.addedLines.length === 0) {
          findings.push(
            makeFinding(
              RULE_ID,
              "high",
              `large test file shrink: -${f.deletedLines.length} lines`,
              { file: f.path }
            )
          );
        }
      }
    }
    return findings;
  }
};
