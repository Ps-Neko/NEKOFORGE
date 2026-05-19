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
  }
];

export function findSkillPack(id: string): SkillPackDef | undefined {
  return SKILL_PACK_CATALOG.find((p) => p.id === id);
}
