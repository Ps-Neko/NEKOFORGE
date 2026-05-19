/**
 * architecture rule (Phase QF): untyped-api-risk.
 *
 * 공개 API 또는 함수 시그니처에 `any` / `as any` / 빈 반환 타입 어노테이션 검출.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "untyped-api-risk";

const PUBLIC_API_RE = /^\s*export\s+(async\s+)?function\s+\w+\s*\(.*\)\s*(?!:)/;
const ANY_TYPE_RE = /:\s*any\b/;
const AS_ANY_RE = /\bas\s+any\b/;

export const untypedApiRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "공개 API 의 any / as any / 반환 타입 누락 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(ts|tsx)$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (ANY_TYPE_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "explicit `: any` type annotation",
              { file: f.path, line: idx + 1 }
            )
          );
        } else if (AS_ANY_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "`as any` cast bypasses type checking",
              { file: f.path, line: idx + 1 }
            )
          );
        } else if (PUBLIC_API_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "exported function missing return type annotation",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
