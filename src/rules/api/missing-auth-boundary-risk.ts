/**
 * api-safety rule: missing-auth-boundary-risk.
 *
 * src/api/, src/server/, src/routes/ 의 새 핸들러 추가 + auth middleware
 * 표시 (requireAuth / verifyJwt / AuthGuard / passport / Depends(get_current_user))
 * 표시 부재. auth-bypass rule (제거 감지) 의 보완 — 새 핸들러가 처음부터 인증
 * 없이 추가되는 경우를 감지.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-auth-boundary-risk";

const API_PATH_RE =
  /(^|\/)(src\/(api|server|routes|controllers)|app\/api)\/.+\.(ts|js|mjs|py)$/;
const HANDLER_RE = /\b(export\s+(async\s+)?function|router\.\w+\(|app\.\w+\(|@(Get|Post|Put|Delete|Patch)\()/;
const AUTH_TOKEN_RE =
  /\b(requireAuth\(|verifyJwt\(|verifyToken\(|AuthGuard|@UseGuards\(|passport\.authenticate|Depends\(get_current_user|@login_required|RequireAuth\(|AuthMiddleware\()/;
const PUBLIC_HINT_RE = /\b(public|webhook|health|status|ping)\b/i;

export const missingAuthBoundaryRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "API 핸들러 추가 + auth middleware 표시 부재",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!API_PATH_RE.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const added = f.addedLines.join("\n");
      if (added.length === 0) continue;
      const hasHandler = HANDLER_RE.test(added);
      if (!hasHandler) continue;
      const hasAuth = AUTH_TOKEN_RE.test(added);
      const looksPublic = PUBLIC_HINT_RE.test(f.path);
      if (!hasAuth && !looksPublic) {
        findings.push(
          makeFinding(
            RULE_ID,
            "warning",
            "API handler added without explicit auth middleware marker (or `public/webhook/health` path hint)",
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
