/**
 * api-safety rule (Phase RP-2): missing-input-validation-risk.
 *
 * 백엔드 핸들러가 req.body / req.query 를 schema 검증 없이 바로 사용하는 패턴 탐지.
 * 휴리스틱: `req.body` 또는 `req.query` 직접 참조 + 같은 함수 안에 zod/joi/yup/ajv 호출 없음.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-input-validation-risk";

const DIRECT_BODY_RE = /\breq\.(body|query|params)(?!\s*[a-zA-Z_])/;
// 검증으로 인정하는 명시적 라이브러리/메서드.
//  - zod/joi/yup/ajv 이름
//  - `.safeParse(` (zod 전용)
//  - validateSync/validateAsync/validate(
//  - schema 변수의 `.parse(` — 단, JSON/Date/URL 등 표준 파서는 제외해야 함.
// 표준 `.parse(`(JSON.parse/Date.parse/URL.parse/path.parse/qs.parse 등)는 검증이
// 아니므로 매칭에서 제외 — 이들이 잘못 억제하던 FN 수정.
const STD_PARSE_OWNERS =
  "JSON|Date|URL|URLSearchParams|Number|Boolean|Math|qs|querystring|path|semver|Buffer|BigInt";
const VALIDATION_RE = new RegExp(
  [
    "\\b(zod|joi|yup|ajv)\\b",
    "\\.safeParse\\(",
    "\\b(validateSync|validateAsync)\\b",
    "\\bvalidate\\(",
    // 표준 파서 소유자가 아닌 식별자의 `.parse(` 만 schema 검증으로 인정.
    `(?<!\\b(?:${STD_PARSE_OWNERS}))\\.parse\\(`
  ].join("|")
);

export const missingInputValidationRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "백엔드 핸들러가 req.body/query/params 를 schema 검증 없이 사용",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(ts|js|mjs)$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      // 본 파일 added 라인 전체 결합 — 함수 단위 분리 어렵지만 휴리스틱으로 충분.
      const added = f.addedLines.join("\n");
      const usesDirect = DIRECT_BODY_RE.test(added);
      const hasValidation = VALIDATION_RE.test(added);
      if (usesDirect && !hasValidation) {
        const lineIdx = f.addedLines.findIndex((l) => DIRECT_BODY_RE.test(l));
        findings.push(
          makeFinding(
            RULE_ID,
            "warning",
            "req.body/query/params used without schema validation (zod/joi/yup/ajv)",
            { file: f.path, line: lineIdx + 1 }
          )
        );
      }
    }
    return findings;
  }
};
