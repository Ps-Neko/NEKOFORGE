/**
 * demo auto 가 보여주는 "AI 가 짠 코드" diff.
 * 부트스트랩 = 대표 예시(실 claude 산출과 같은 형태). Task 5 에서 `demo auto --real` 로
 * 캡처한 진짜 diff 로 교체한다. verdict 는 이 diff 에 매번 runGate 가 라이브 계산한다(I1).
 */
export const AUTO_DEMO_DIFF = [
  "diff --git a/src/auth/login.ts b/src/auth/login.ts",
  "index 1111111..2222222 100644",
  "--- a/src/auth/login.ts",
  "+++ b/src/auth/login.ts",
  "@@ -1,5 +1,9 @@",
  " export interface LoginInput { email: string; password: string }",
  " ",
  " export function canLogin(input: LoginInput): boolean {",
  "-  return input.email.length > 0 && input.password.length >= 8;",
  "+  if (!input.email.includes(\"@\")) return false;",
  "+  if (input.password.length < 8) return false;",
  "+  return true;",
  " }",
  "+",
  "+export function isLocked(attempts: number): boolean {",
  "+  return attempts >= 5;",
  "+}"
].join("\n") + "\n";
