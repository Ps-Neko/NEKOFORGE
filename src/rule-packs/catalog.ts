/**
 * Rule pack catalog (Phase RP) — 13 큐레이션 pack. 각 pack 은 rule id 목록 + 정체성 설명.
 *
 * ⚠️ 이 카탈로그는 pack 의 '정의'다. enabledPacks/disabledPacks 토글은 **어떤 룰이 실행되는지
 *    제어하지 않는다** — 모든 결정적 룰은 항상 실행된다(게이트는 보수적: 룰이 더 도는 쪽이 더 엄격).
 *    토글은 (a) uniqueTriggeredPacks 의 '트리거된 pack' 보고 범위와 (b) 필수 pack 정책에만 쓰인다.
 *    resolveRulePacks 가 enabledRules 를 계산하지만 현재 phase-rules 는 실행 필터로 쓰지 않는다.
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
      "rule-pack-missing"
    ],
    describe: "계약/점수 강제 — schema valid + required rule-pack 존재 확인"
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
