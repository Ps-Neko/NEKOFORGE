/**
 * api-safety rule: unsafe-error-exposure-risk.
 *
 * catch 블록에서 error.stack / error.message 를 그대로 response 로 노출하는 패턴.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "unsafe-error-exposure-risk";

const STACK_EXPOSE_RE =
  /\b(res|response|reply|ctx)\.(json|send|status\(\d+\)\.json|status\(\d+\)\.send)\s*\(\s*\{?[^}]*\b(stack|message)\b/;

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
