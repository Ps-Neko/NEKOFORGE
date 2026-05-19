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

export const largeFileRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "단일 파일 변경량이 임계치를 넘으면 경고 (해체 권장)",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;
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
