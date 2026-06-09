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
  /(^|\/)(auth|login|signup|signin|register|forgot|reset|verify|password|session|token|otp|mfa)[^/]*\.(ts|js|mjs)$/i;
// 도메인파일(users.ts 등)에 인증 라우트가 들어있는 경우도 added 본문에서 감지.
const AUTH_ROUTE_RE =
  /\b(login|signin|signup|register|forgot[- ]?password|reset[- ]?password|password[- ]?reset|verify[- ]?otp|\botp\b|\bmfa\b|two[- ]?factor|authenticate)\b/i;
// rateLimit / rateLimiter() / express-rate-limit / @Throttle / throttler 등.
// `rateLimiter()` 가 \brateLimit\b 워드바운더리에 불일치해 보호코드 오발화하던 FP 수정.
const RATE_LIMIT_RE =
  /\b(rateLimit\w*|express-rate-limit|@Throttle|throttler?|fastify-rate-limit|RateLimiter\w*|rate-limiter)\b/i;
// 도메인파일이 auth 라우트를 품을 때만 body-기반 탐지를 적용할 API 표면.
const API_SURFACE_RE =
  /(^|\/)(src\/(api|server|routes|controllers|handlers)|app\/api|pages\/api)\/.+\.(ts|js|mjs)$/;

export const missingRateLimitRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "auth/login 핸들러 추가 + rate limit 표시 부재",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;
      const added = f.addedLines.join("\n");
      if (added.length === 0) continue;
      // 파일명이 auth 핸들러이거나, API 표면의 도메인파일이 auth 라우트를 추가한 경우.
      const pathMatch = AUTH_HANDLER_RE.test(f.path);
      const bodyMatch = API_SURFACE_RE.test(f.path) && AUTH_ROUTE_RE.test(added);
      if (!pathMatch && !bodyMatch) continue;
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
