/**
 * api-safety rule: unsafe-error-exposure-risk.
 *
 * catch 블록에서 error.stack / error.message 를 그대로 response 로 노출하는 패턴.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "unsafe-error-exposure-risk";

// 응답 sink 가 error 의 .stack / .message 를 *property access* 형태로 노출할 때만.
// 성공응답 `res.json({ message: "Account created" })` 의 bare `message` 키는 dot 앞이
// 없으므로 불일치 (FP 제거). `err.message` / `error.stack` 형태만 매칭.
const STACK_EXPOSE_RE =
  /\b(res|response|reply|ctx)\.(json|send|status\(\d+\)\.json|status\(\d+\)\.send)\s*\(\s*\{?[^}]*\.(stack|message)\b/;

export const unsafeErrorExposureRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "catch 에서 error.stack/message 직접 응답 노출",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(ts|js|mjs)$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        if (STACK_EXPOSE_RE.test(line)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "response body exposes error.stack or error.message directly",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
