/**
 * SECURITY.md §3.2 — 인증/인가 미들웨어 제거·우회·완화 탐지.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";
import { astAuthBypassFindings, dedupeFindings } from "./ast-scan.js";

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

/**
 * 주석·문자열-only 라인인지. 이런 라인의 토큰은 실제 코드가 아니므로 카운팅에서 제외한다.
 * (진짜 `requireAuth(` 삭제를, 같은 토큰을 언급한 주석/문자열 추가로 상쇄해 가리는 마스킹 방지.)
 */
function isCommentOrStringOnly(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  // 라인 주석/블록 주석 시작.
  if (t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*")) {
    return true;
  }
  // 순수 문자열 리터럴 라인 (따옴표로 시작/끝, 후행 콤마/세미콜론 허용).
  if (/^(['"`]).*\1[,;]?$/.test(t)) return true;
  return false;
}

export const authBypassRule: DeterministicRule = {
  id: RULE_ID,
  describe: "인증/인가 우회 또는 미들웨어 제거 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];

    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;

      const realAdded = f.addedLines.filter((l) => !isCommentOrStringOnly(l));
      const realDeleted = f.deletedLines.filter((l) => !isCommentOrStringOnly(l));
      for (const token of AUTH_TOKENS) {
        const removedCount = realDeleted.filter((l) => l.includes(token)).length;
        const addedCount = realAdded.filter((l) => l.includes(token)).length;
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
      // AST 보강 — 정규식이 놓치는 정적 항상-참 가드(if (1===1), if (!false) 등).
      findings.push(...astAuthBypassFindings(f.addedLines, f.path, RULE_ID));
    }
    return dedupeFindings(findings);
  }
};
