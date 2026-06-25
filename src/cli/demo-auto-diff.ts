/**
 * demo auto 가 보여주는 "AI 가 짠 코드" diff.
 * ★실제 캡처본: 2026-06-26 `demo auto --real` 워커(createClaudeWorkerAdapter)가
 *  시드된 샌드박스에서 생성한 진짜 claude diff. 손수 만든 예시가 아님.
 *  verdict 는 이 diff 에 매번 runGate 가 라이브 계산한다(I1, 위조 없음).
 *  재생성: `npx tsx src/cli/index.ts demo auto --real` (또는 워커만 캡처) 후 이 상수 교체.
 */
export const AUTO_DEMO_DIFF = "diff --git a/src/auth/login.ts b/src/auth/login.ts\nindex 291da30..07227cd 100644\n--- a/src/auth/login.ts\n+++ b/src/auth/login.ts\n@@ -1,5 +1,9 @@\n export interface LoginInput { email: string; password: string }\n \n export function canLogin(input: LoginInput): boolean {\n-  return input.email.length > 0 && input.password.length >= 8;\n+  return input.email.length > 0 && input.email.includes(\"@\") && input.password.length >= 8;\n+}\n+\n+export function isLocked(attempts: number): boolean {\n+  return attempts >= 5;\n }\n";
