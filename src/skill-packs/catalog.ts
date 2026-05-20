/**
 * Skill pack catalog (Phase RP) — 7 큐레이션 pack.
 *
 * skill pack 은 verdict 를 직접 만들지 않는다.
 * worker prompt + quality-policy + checklist 에 들어가는 실행 지침.
 */
export interface SkillPackDef {
  id: string;
  appliesTo: string;
  guidance: string[];
}

export const SKILL_PACK_CATALOG: readonly SkillPackDef[] = [
  {
    id: "typescript-quality",
    appliesTo: "TS/JS",
    guidance: [
      "strict typing — no `any` in public API",
      "test-first — write failing test before implementation",
      "module boundary — exported function 의 입출력 명세 명시",
      "immutable update — spread / Readonly 활용"
    ]
  },
  {
    id: "backend-api-quality",
    appliesTo: "Backend API",
    guidance: [
      "auth required on every protected route",
      "input validation at boundary (schema)",
      "structured error response (envelope)",
      "rate limit on public endpoints",
      "structured logging (PII 마스킹)"
    ]
  },
  {
    id: "web-ui-quality",
    appliesTo: "Web UI",
    guidance: [
      "accessibility — alt, aria-label, role 명시",
      "design token — hex 리터럴 대신 CSS variable 사용",
      "responsive — fixed-width 회피, breakpoint 명시",
      "interaction state — hover/focus/disabled/loading 모두 디자인"
    ]
  },
  {
    id: "cli-tool-quality",
    appliesTo: "CLI",
    guidance: [
      "exit code 표준 (0 ok, 1 generic, 2 precond, 3 approval, 4 block)",
      "stderr=human, stdout=machine",
      "--help / --version 항상 응답",
      "non-interactive mode 명시 (--non-interactive + --answers)"
    ]
  },
  {
    id: "library-quality",
    appliesTo: "Library",
    guidance: [
      "public API 안정성 — semver 준수",
      "breaking change → major bump + migration note",
      "tests — public API 의 모든 path 커버",
      "docs — README + API reference + 예제"
    ]
  },
  {
    id: "release-readiness",
    appliesTo: "Release",
    guidance: [
      "CHANGELOG 또는 RELEASE-NOTES 갱신",
      "benchmark smoke 통과",
      "migration note (breaking 시)",
      "rollback path 명시",
      "monitoring alarm 설정"
    ]
  },
  {
    id: "evidence-writing",
    appliesTo: "all",
    guidance: [
      "worker result 는 status + summary + findings 구조 준수",
      "finding 은 severity + title + file + line (가능시)",
      "evidence summary 는 무엇을 했고/무엇을 못했고/왜 인지 한 문단",
      "decision.json 은 작성 금지 (gate 단독)"
    ]
  },
  // Phase RP-2 (v0.5) — 6 신규 skill pack
  {
    id: "testing-quality",
    appliesTo: "all",
    guidance: [
      "happy path 1 + edge case 2 + failure case 1 의 최소 4 케이스",
      "테스트는 외부 spawn 회피 (internal:noop hook 활용)",
      "fixture 작성 시 cross-rule interference 회피 (BENCHMARKS.md §4.A)",
      "test-deletion 회피 — 기존 test 삭제·rename 금지"
    ]
  },
  {
    id: "security-review-writing",
    appliesTo: "security-reviewer worker",
    guidance: [
      "secret-fallback / auth-bypass / dangerous-file-write / hook-injection 카테고리 점검",
      "발견은 severity (critical/high/warning/info) + file + line + 재현 방법",
      "false positive 의심 시 negative fixture 후보 제안",
      "OWASP top 10 매핑 (가능 시)"
    ]
  },
  {
    id: "architecture-review-writing",
    appliesTo: "architect worker",
    guidance: [
      "변경 영향도 (blast radius) 한 문단",
      "단방향 의존성 / cross-stage 회피 확인",
      "800 LOC 임계 근접 파일 식별",
      "test boundary 와 module boundary 일치 여부"
    ]
  },
  {
    id: "release-note-writing",
    appliesTo: "release",
    guidance: [
      "Summary 한 문장 — 사용자에게 무엇이 달라지는가",
      "Breaking changes 명시 + migration note 짝짓기",
      "New features 표 — 영역별",
      "Tests / Benchmark 갱신 통계 — local fixtures 명시"
    ]
  },
  {
    id: "migration-writing",
    appliesTo: "breaking change",
    guidance: [
      "Before / After 코드/명령 한 쌍",
      "사용자가 수동 실행할 명령 시퀀스",
      "자동 마이그레이션 가능 영역과 수동 영역 분리",
      "rollback 경로 명시"
    ]
  },
  {
    id: "external-review-prep",
    appliesTo: "release",
    guidance: [
      "무엇이 바뀌었는가 요약",
      "깨지면 안 되는 invariant 목록",
      "리뷰어가 먼저 봐야 할 파일 경로 목록",
      "알려진 한계 명시 (의도된 / 미구현)",
      "self-host verdict + decision.json 핵심 필드 요약 첨부"
    ]
  }
];

export function findSkillPack(id: string): SkillPackDef | undefined {
  return SKILL_PACK_CATALOG.find((p) => p.id === id);
}
