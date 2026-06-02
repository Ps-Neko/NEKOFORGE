/**
 * gate evidence 보조 — 필수 증거 목록 + review/test 상태 추론.
 *
 * gate/index.ts 에서 분리(Step 1 모듈화). 외부 호출/타입을 그대로 노출하며
 * runGate 가 import 해 사용한다. 본 모듈은 다른 gate 서브모듈을 import 하지 않는다.
 */

export interface TeamJson {
  pattern?: string;
  agents?: Array<{ id: string; role: string; owns: string[] }>;
}

export interface CodexFindings {
  adapterId?: string;
  status: "passed" | "warnings" | "failed" | "not_run";
  findings: Array<{ severity: string; title: string }>;
}

export interface QualityContractJson {
  taskId: string;
  qualityBars: Record<string, { minimum: number; required: boolean }>;
  riskProfile?: { uiTouched?: boolean };
}

export interface HookResultsJson {
  results?: Array<{
    hookId?: string;
    status?: string;
    command?: string;
    exitCode?: number;
  }>;
}

export const REQUIRED_EVIDENCE = [
  "SPEC.md",
  "PLAN.md",
  "TASKS.md",
  "harness-design.md",
  "team.json",
  "quality-policy.md",
  "rules.json",
  "hooks.json",
  "team-runtime.md",
  "agent-routing.json",
  "worklog.md",
  "quality-contract.json"
] as const;

/**
 * 3번 — review adapter 무시(--no-review-adapter) 시 reviewStatus 를 not_run 으로
 * 강제해 "검증 안 함"이 verdict 에 가시화되게 한다(ⓐ 강등 + strict 차단과 연동).
 * codex status 가 임의값이어도 유효 union 으로 정규화한다.
 */
export function resolveReviewStatus(
  noReviewAdapter: boolean,
  codexStatus: string | undefined
): "passed" | "warnings" | "failed" | "not_run" {
  if (noReviewAdapter) return "not_run";
  if (
    codexStatus === "passed" ||
    codexStatus === "warnings" ||
    codexStatus === "failed"
  ) {
    return codexStatus;
  }
  return "not_run";
}

export function hasNamedAdapter(c: CodexFindings): boolean {
  return !!c.adapterId && c.adapterId !== "none";
}

/**
 * self-host #6 후속 — work 단계의 post-tool hook 결과에서 `npm test` 류 명령을
 * 찾아 tests.status 자동 추정. CLI 의 --test-status 명시값이 우선.
 */
export function inferTestStatusFromHooks(
  data: HookResultsJson | null
): "passed" | "failed" | "not_run" | null {
  if (!data || !Array.isArray(data.results)) return null;
  const testHook = data.results.find(
    (r) =>
      typeof r.command === "string" &&
      /(^|\s)(npm|yarn|pnpm|bun)\s+(test|run\s+test)\b/.test(r.command)
  );
  if (!testHook) return null;
  if (testHook.status === "ok") return "passed";
  if (testHook.status === "failed") return "failed";
  return null;
}
