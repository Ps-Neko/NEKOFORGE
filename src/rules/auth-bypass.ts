/**
 * SECURITY.md §3.2 — 인증/인가 미들웨어 제거·우회·완화 탐지.
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "auth-bypass";

const AUTH_TOKENS = [
  // TS/JS
  "requireAuth(",
  "isAuthenticated(",
  "verifyJwt(",
  "verifyToken(",
  "checkPermission(",
  "@PreAuthorize",
  "@AuthGuard",
  "ensureLoggedIn(",
  "passport.authenticate(",
  // Python (Django/Flask/FastAPI)
  "@login_required",
  "@permission_required",
  ".is_authenticated",
  "Depends(get_current_user",
  "@require_auth",
  // Go
  "RequireAuth(",
  "AuthMiddleware(",
  "MustAuth(",
  "VerifyJWT(",
  // Java/Spring
  "@PreAuthorize",
  "@Secured"
];

const BYPASS_PATTERNS: Array<{ re: RegExp; msg: string }> = [
  { re: /\bif\s*\(\s*true\s*\)/, msg: "if (true) bypass" },
  { re: /\bif\s*\(\s*1\s*\)/, msg: "if (1) bypass" },
  {
    re: /process\.env\.NODE_ENV\s*!==?\s*['"]production['"]/,
    msg: "non-production conditional auth"
  },
  { re: /\/\/\s*(auth|authorization)\s*(disabled|skip|bypass)/i, msg: "comment disables auth" },
  // Python
  { re: /^\s*#\s*(auth|authorization)\s*(disabled|skip|bypass)/i, msg: "python comment disables auth" },
  { re: /\bif\s+True\s*:/, msg: "if True: bypass" },
  // Go
  { re: /\bif\s+os\.Getenv\(['"]ENV['"]\)\s*!=\s*['"]production['"]/, msg: "go non-production conditional auth" }
];

export const authBypassRule: DeterministicRule = {
  id: RULE_ID,
  describe: "인증/인가 우회 또는 미들웨어 제거 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];

    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;

      for (const token of AUTH_TOKENS) {
        const removedCount = f.deletedLines.filter((l) => l.includes(token)).length;
        const addedCount = f.addedLines.filter((l) => l.includes(token)).length;
        if (removedCount > addedCount) {
          findings.push(
            makeFinding(
              RULE_ID,
              "critical",
              `auth gate "${token}" removed without replacement`,
              { file: f.path }
            )
          );
        }
      }

      f.addedLines.forEach((line, idx) => {
        for (const p of BYPASS_PATTERNS) {
          if (p.re.test(line)) {
            findings.push(
              makeFinding(RULE_ID, "critical", `auth bypass pattern: ${p.msg}`, {
                file: f.path,
                line: idx + 1
              })
            );
          }
        }
      });
    }
    return findings;
  }
};
