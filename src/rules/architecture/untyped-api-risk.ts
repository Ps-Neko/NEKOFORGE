/**
 * architecture rule (Phase QF): untyped-api-risk.
 *
 * 공개 API 또는 함수 시그니처에 `any` / `as any` / 빈 반환 타입 어노테이션 검출.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "untyped-api-risk";

// 공개 함수 선언 (이름까지). 반환 타입 유무는 별도로 판정한다.
const PUBLIC_FN_DECL_RE = /^\s*export\s+(async\s+)?function\s+\w+\s*\(/;
// arrow-export 시그니처 (export const f = (...) => / async (...) =>).
const PUBLIC_ARROW_DECL_RE = /^\s*export\s+const\s+\w+\s*=\s*(async\s+)?\(/;
// 시그니처가 반환 타입 어노테이션을 가졌는지: 닫는 괄호 뒤 `:` 가 본문({ / =>) 앞에 옴.
const HAS_RETURN_TYPE_RE = /\)\s*:\s*[^=]/;
// `: any` 뿐 아니라 제네릭 위치의 any (`<any`, `,any`, `<...,any>`) 도 포함.
const ANY_TYPE_RE = /(:\s*any\b|<\s*any\b|,\s*any\b|\bany\s*>)/;
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
        } else if (
          (PUBLIC_FN_DECL_RE.test(line) || PUBLIC_ARROW_DECL_RE.test(line)) &&
          !HAS_RETURN_TYPE_RE.test(line)
        ) {
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
