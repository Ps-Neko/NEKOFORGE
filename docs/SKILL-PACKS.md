# SKILL PACKS — Phase RP

> Skill Pack 은 rule 처럼 verdict 를 직접 만들지 않는다.
> **worker prompt + quality-policy + checklist** 에 들어가는 실행 지침.

## 1. 정체성

```text
skill pack 은 행동 지침 (worker 가 무엇을 해야 하는가)
rule pack 은 위험 탐지 (gate 가 무엇을 막는가)
skill pack 누락은 직접 BLOCK 아님 — warning 또는 NEEDS_HUMAN_REVIEW
```

> (2026-05) enabled skill pack(내장 카탈로그 + 채용분)의 guidance 는 `renderSkillGuidance` 를 통해 dispatch/auto 워커 프롬프트에 `## 스킬팩 지침` 블록으로 주입된다.

## 2. Skill Pack 13종

| Skill Pack | 적용 대상 | 내용 |
|---|---|---|
| `typescript-quality` | TS/JS | strict typing, no-any, test-first, module boundary |
| `backend-api-quality` | API | auth, validation, error handling, rate limit, logging |
| `web-ui-quality` | UI | accessibility, design token, responsive, interaction states |
| `cli-tool-quality` | CLI | exit code, stderr/stdout, help text, non-interactive mode |
| `library-quality` | library | public API stability, semver, docs, tests |
| `release-readiness` | release | changelog, benchmark, migration note, rollback |
| `evidence-writing` | all | worker result, findings, evidence summary 작성 규칙 |
| `testing-quality` | all | happy/edge/failure test discipline, fixture hygiene |
| `security-review-writing` | security-reviewer worker | security finding format and false-positive notes |
| `architecture-review-writing` | architect worker | blast radius, boundary, large-file, test-boundary review |
| `release-note-writing` | release | summary, breaking changes, benchmark/local fixture notes |
| `migration-writing` | breaking change | before/after, manual/automatic migration, rollback |
| `external-review-prep` | release | review summary, invariants, risks, self-host evidence |

## 3. CLI

```bash
harness skill-pack list
harness skill-pack enable <pack>
harness skill-pack disable <pack>
harness skill-pack status
harness skill-pack audit
```

## 4. Template 자동 추천 (skill-packs.json)

```json
{
  "schemaVersion": "0.5",
  "enabledPacks": ["typescript-quality", "evidence-writing"],
  "disabledPacks": [],
  "recommendedForTemplates": {
    "web-ui": ["typescript-quality", "web-ui-quality", "evidence-writing"],
    "backend-api": ["typescript-quality", "backend-api-quality", "release-readiness", "evidence-writing"],
    "cli-tool": ["typescript-quality", "cli-tool-quality", "evidence-writing"],
    "library": ["typescript-quality", "library-quality", "release-readiness", "evidence-writing"]
  }
}
```

## 5. Gate 통합

```json
{
  "skillPacks": {
    "status": "complete | missing | partial",
    "enabled": ["typescript-quality", "evidence-writing"],
    "recommended": ["backend-api-quality"],
    "missingRecommended": ["backend-api-quality"]
  }
}
```

Verdict 영향:

```text
recommended skill pack missing (safe mode)    → PASS_WITH_WARNINGS
recommended skill pack missing (release mode) → NEEDS_HUMAN_REVIEW
skill pack 자체로는 직접 BLOCK 만들지 않음
```

## 6. 본 문서가 답하지 않는 것

- rule pack 정의 → docs/RULE-PACKS.md
- worker prompt 가 skill pack 을 어떻게 흡수하는가 → `src/core/skill-packs/render.ts`
