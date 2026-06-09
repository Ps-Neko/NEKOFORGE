/**
 * architecture rule (Phase QF): large-file-risk.
 *
 * 단일 파일이 (added - deleted) 기준 임계치를 넘는 변경량을 가질 때 경고.
 * 또는 추가된 라인 수가 임계치를 넘으면 경고.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "large-file-risk";

const ADDED_LINES_HIGH = 600;
const ADDED_LINES_WARNING = 300;

// 생성물(손으로 유지하지 않는 파일)은 라인 수가 커도 "해체" 대상이 아니다.
// lockfile / snapshot / 타입선언 번들 / 미니파이 번들 / 대형 fixture 데이터 등.
const GENERATED_FILE_RE =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Cargo\.lock|poetry\.lock|Gemfile\.lock)$/;
const GENERATED_EXT_RE = /\.(snap|d\.ts|min\.js|min\.css|map|lock)$/;
const FIXTURE_PATH_RE = /(^|\/)(fixtures?|__snapshots__|__fixtures__|testdata)\//;

function isGenerated(path: string): boolean {
  return (
    GENERATED_FILE_RE.test(path) ||
    GENERATED_EXT_RE.test(path) ||
    FIXTURE_PATH_RE.test(path)
  );
}

export const largeFileRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "단일 파일 변경량이 임계치를 넘으면 경고 (해체 권장)",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;
      if (isGenerated(f.path)) continue;
      const added = f.addedLines.length;
      if (added >= ADDED_LINES_HIGH) {
        findings.push(
          makeFinding(
            RULE_ID,
            "high",
            `large file change: +${added} lines (threshold ${ADDED_LINES_HIGH})`,
            { file: f.path }
          )
        );
      } else if (added >= ADDED_LINES_WARNING) {
        findings.push(
          makeFinding(
            RULE_ID,
            "warning",
            `large file change: +${added} lines (threshold ${ADDED_LINES_WARNING})`,
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
