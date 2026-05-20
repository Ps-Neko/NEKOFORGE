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
const VALIDATION_RE =
  /\b(zod|joi|yup|ajv|\.parse\(|\.safeParse\(|validateSync|validateAsync|validate\()/;

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
