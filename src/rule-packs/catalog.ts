/**
 * Rule pack catalog (Phase RP) — 13 큐레이션 pack.
 *
 * 각 pack 은 rule id 목록 + 짧은 정체성 설명.
 * gate 가 enabledPacks 를 보고 rule id 집합을 결정.
 */
export interface RulePackDef {
  id: string;
  rules: string[];
  describe: string;
}

export const RULE_PACK_CATALOG: readonly RulePackDef[] = [
  {
    id: "security-core",
    rules: [
      "secret-fallback",
      "auth-bypass",
      "dangerous-file-write",
      "hook-injection-risk",
      "agent-permission-risk"
    ],
    describe: "보안 최소선 — secret/auth/dangerous file/hook/agent 권한"
  },
  {
    id: "test-discipline",
    rules: ["test-deletion", "no-test-risk"],
    describe: "테스트 품질 — 삭제·.skip 차단 + src 변경 동반 테스트 압력"
  },
  {
    id: "architecture-core",
    rules: [
      "large-file-risk",
      "layer-violation",
      "circular-dependency-risk",
      "untyped-api-risk"
    ],
    describe: "구조 품질 — 800 LOC / cross-stage / 형제 import / any 타입"
  },
  {
    id: "design-web",
    rules: ["accessibility-risk", "design-token-violation", "responsive-break-risk"],
    describe: "UI/UX 품질 — uiTouched 자동 활성"
  },
  {
    id: "release-strict",
    rules: ["codex-missing-risk", "auto-apply-block", "release-benchmark-required"],
    describe: "출고 엄격 모드 — review adapter + benchmark smoke"
  },
  {
    id: "ai-generated-code-risk",
    rules: ["no-test-risk", "untyped-api-risk", "secret-fallback", "auth-bypass"],
    describe: "AI 산출물 흔한 위험 — 테스트 없는 코드 + any + secret/auth"
  },
  {
    id: "worker-safety-core",
    rules: ["worker-safety-risk", "agent-permission-risk"],
    describe: "Worker 통제 — forbidden action 감지 + role 권한"
  },
  {
    id: "quality-contract-core",
    rules: [
      "quality-contract-invalid",
      "quality-score-required",
      "failed-required-bars"
    ],
    describe: "계약/점수 강제 — schema valid + score 산출 + bar 충족"
  },
  // Phase RP-2 (v0.5) — 5 신규 pack
  {
    id: "docs-quality",
    rules: [
      "stale-count-risk",
      "missing-release-note-risk",
      "missing-cli-doc-risk",
      "broken-doc-link-risk"
    ],
    describe: "문서 정합 — README/RELEASE-NOTES/CLI docs 일관성 (placeholder rule, 다음 회차 휴리스틱 추가 예정)"
  },
  {
    id: "release-evidence",
    rules: [
      "release-benchmark-required",
      "missing-self-host-risk",
      "missing-migration-note-risk",
      "missing-external-review-risk"
    ],
    describe: "release 전 evidence 누락 방지 (benchmark / self-host / migration / external review)"
  },
  {
    id: "api-safety",
    rules: [
      "missing-input-validation-risk",
      "missing-rate-limit-risk",
      "unsafe-error-exposure-risk",
      "missing-auth-boundary-risk"
    ],
    describe: "backend-api 실질 보안 강화 — missing-input-validation 1 신규 + 3 placeholder"
  },
  {
    id: "frontend-accessibility",
    rules: [
      "accessibility-risk",
      "missing-focus-state-risk",
      "interactive-div-risk",
      "missing-loading-state-risk",
      "contrast-token-risk"
    ],
    describe: "web-ui template 품질 강화 — accessibility-risk + 4 placeholder"
  },
  {
    id: "dependency-risk",
    rules: [
      "unbounded-version-risk",
      "new-runtime-dependency-risk",
      "postinstall-script-risk",
      "lockfile-mismatch-risk"
    ],
    describe: "package / dependency 변경 위험 — unbounded-version 1 신규 + 3 placeholder"
  }
];

export function findRulePack(id: string): RulePackDef | undefined {
  return RULE_PACK_CATALOG.find((p) => p.id === id);
}
