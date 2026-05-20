/**
 * api-safety rule: missing-rate-limit-risk.
 *
 * auth/ 또는 login 핸들러 추가 + rate limit 표시 (rateLimit / express-rate-limit /
 * @nestjs/throttler / fastify-rate-limit) 부재.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-rate-limit-risk";

const AUTH_HANDLER_RE =
  /(^|\/)(auth|login|signup|signin|forgot|reset|verify)[^/]*\.(ts|js|mjs)$/i;
const RATE_LIMIT_RE =
  /\b(rateLimit|express-rate-limit|@Throttle|throttler|fastify-rate-limit|RateLimiterMemory)\b/i;

export const missingRateLimitRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "auth/login 핸들러 추가 + rate limit 표시 부재",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!AUTH_HANDLER_RE.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const added = f.addedLines.join("\n");
      if (added.length === 0) continue;
      if (!RATE_LIMIT_RE.test(added)) {
        findings.push(
          makeFinding(
            RULE_ID,
            "warning",
            `auth-related handler without explicit rate limit marker (${f.path})`,
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
