# ARCHITECTURE — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 PRODUCT.md §3 원칙(분리·차단·증거·독립·로컬·도구 독립·설계 실행 분리)을 만족하는 구현 구조를 정의한다. 구현 task 는 TASKS.md 에서 본 구조를 그대로 참조한다.

## 1. 설계 목표 (Architectural Goals)

본 아키텍처가 만족해야 할 비기능 요구는 PRODUCT.md 의 7대 약속에서 직역된다.

| 목표 | 기원 (PRODUCT 약속) | 구조적 표현 |
|---|---|---|
| 단계 분리 | §7.1 | 각 단계는 `src/core/<stage>/` 모듈로 1:1, 다른 단계 내부 함수 직접 호출 금지 (artifact 통신만) |
| 차단 보장 | §7.2 | apply 모듈은 `decision.json` schema 검증 → verdict 확인 → 위반 시 throw, 3중 방어 |
| 증거 보장 | §7.3 | 모든 단계가 `Artifact` 인터페이스로 `.md` + `.json` 짝 출력 |
| 독립성 보장 | §7.4 | review 모듈은 `ReviewAdapter` 인터페이스로만 외부 호출, gate 는 어댑터 단독 PASS 금지 |
| 로컬 우선 | §7.5 | 네트워크 호출 없이 기본 명령 동작 가능. 외부 호출은 `integrations/` 격리 |
| 도구 독립 (v3) | §7.6 | `.harness/` 가 SoT. `.claude/` 등은 `integrations/<tool>/export.ts` 출력만 |
| 설계·실행 분리 (v3) | §7.7 | `core/harness-design/` 과 `core/team/` 이 별도 모듈, 후자가 전자의 산출물을 입력으로 사용 |

## 2. 7개 참고와 모듈 매핑 (v3)

PRODUCT.md §4 의 "역할 흡수" 를 실제 디렉터리에 못박는다. 흡수는 패턴 차용이지 코드 복제가 아니다.

```text
intake / clarify / context / spec   ←  Gstack 흡수 영역
plan                                ←  Superpowers 흡수 영역
harness-design                      ←  revfactory/harness 흡수 영역 (v3 신규)
quality-policy                      ←  Everything Claude Code 흡수 영역
team / work                         ←  OMC 흡수 영역
self-review / codex-review          ←  Codex 흡수 영역
gate / apply                        ←  NEKOWORK식 Verified Gate 흡수 영역
memory                              ←  사후 학습용 자체 모듈
```

각 모듈은 다른 영역의 모듈을 import 하지 못한다(§7 의존성 규칙 참고).

## 3. 레포지토리 구조

```text
nekoforge/
├── README.md
├── TASKS.md                          # Phase B 구현 task 분해
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md               # 본 문서
│   ├── WORKFLOW.md
│   ├── HARNESS-DESIGN.md
│   ├── QUALITY-POLICY.md
│   ├── SECURITY.md
│   ├── ROADMAP.md
│   └── CLI.md
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── init.ts
│   │   │   ├── ask.ts
│   │   │   ├── context.ts
│   │   │   ├── spec.ts
│   │   │   ├── plan.ts
│   │   │   ├── design.ts
│   │   │   ├── policy.ts
│   │   │   ├── team.ts
│   │   │   ├── work.ts
│   │   │   ├── review.ts
│   │   │   ├── gate.ts
│   │   │   ├── apply.ts
│   │   │   ├── report.ts
│   │   │   └── export.ts             # subcommand: export claude | cursor | codex
│   │   └── ui/
│   ├── core/
│   │   ├── intake/
│   │   ├── clarify/
│   │   ├── context/
│   │   ├── spec/
│   │   ├── plan/
│   │   ├── harness-design/           # v3 신규
│   │   ├── quality-policy/           # v2 quality-profile 의 후신
│   │   ├── team/
│   │   ├── work/
│   │   ├── review/
│   │   ├── gate/
│   │   ├── apply/
│   │   └── memory/
│   ├── rules/                        # deterministic rules (9종)
│   │   ├── secret-fallback.ts
│   │   ├── auth-bypass.ts
│   │   ├── test-deletion.ts
│   │   ├── no-test-risk.ts
│   │   ├── dangerous-file-write.ts
│   │   ├── hook-injection-risk.ts
│   │   ├── agent-permission-risk.ts
│   │   ├── auto-apply-block.ts
│   │   └── codex-missing-risk.ts
│   ├── hooks/                        # hook 정의/실행 인프라 (ECC 흡수)
│   ├── integrations/                 # 외부 도구 adapter
│   │   ├── codex/                    # ReviewAdapter
│   │   ├── claude/                   # ReviewAdapter + ExportAdapter
│   │   ├── cursor/                   # ExportAdapter
│   │   └── generic/                  # 표준 export 포맷
│   ├── schemas/                      # JSON schema (decision · team · ...)
│   ├── artifact/                     # Artifact 읽기/쓰기 추상화
│   └── utils/                        # fs · diff · 로깅 무상태 헬퍼
├── examples/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .harness/                         # 사용자 워크스페이스 (gitignore 권장)
```

## 4. 14단계 ↔ 모듈 ↔ artifact 매핑

| 단계 | 디렉터리 | 책임 | 입력 artifact | 출력 artifact |
|---|---|---|---|---|
| intake | `core/intake/` | 사용자 원문 저장 | argv `<goal>` | `.harness/intake.md` |
| clarify | `core/clarify/` | 4축 질문 생성 | `intake.md` | `.harness/clarify.md` |
| context | `core/context/` | 도메인·구조·제약 정리 | `clarify.md` | `.harness/context.md` |
| spec | `core/spec/` | Gstack식 7문항 강제 | `context.md` | `.harness/SPEC.md` |
| plan | `core/plan/` | 작은 task + 테스트 계획 | `SPEC.md` | `.harness/PLAN.md`, `.harness/TASKS.md` |
| harness-design | `core/harness-design/` | 도메인→팀 아키텍처 설계 | `SPEC.md`, `PLAN.md` | `.harness/harness-design.md`, `.harness/team.json`, `.harness/orchestrator.md`, `.harness/skills-map.json` |
| quality-policy | `core/quality-policy/` | rules/hooks/context/security 묶음 선택 | `harness-design.md` | `.harness/quality-policy.md`, `.harness/rules.json`, `.harness/hooks.json`, `.harness/context-policy.md` |
| team | `core/team/` | 실행 routing/handoff | `team.json`, `rules.json`, `hooks.json` | `.harness/team-runtime.md`, `.harness/agent-routing.json` |
| work | `core/work/` | task 1건 구현 로그 | `TASKS.md`, `agent-routing.json` | 코드 변경 + `.harness/worklog.md` |
| self-review | `core/review/self.ts` | 자기 검토 | `worklog.md` | `.harness/self-review.md` |
| codex-review | `core/review/codex.ts` | 외부 어댑터 호출 | `worklog.md`, diff | `.harness/codex-review.md`, `.harness/codex-findings.json` |
| gate | `core/gate/` | verdict 통합 산출 | 위 모든 artifact | `REPORT.md`, `.harness/decision.json` |
| apply | `core/apply/` | verdict + 사람 승인 확인 후 적용 | `decision.json` | `.harness/apply-log.md` |
| memory | `core/memory/` | 학습 케이스 적재 | 모든 단계 결과 | `.harness/memory.md`, `.harness/eval-cases/*.json` |

## 5. 핵심 데이터 흐름

```text
argv ──▶ cli/index.ts
              │
              ▼
        cli/commands/<name>.ts
              │
              ▼   (정확히 1개 단계만 호출)
        core/<stage>/index.ts
              │
              ├──▶ artifact/reader   (이전 단계 산출물 로드)
              │
              ├──▶ rules/* (gate 단계에서만)
              │
              ├──▶ hooks/* (work · review 단계에서)
              │
              ├──▶ integrations/* (review · export 단계에서, optional)
              │
              ▼
        artifact/writer (.md + .json 동시 출력)
              │
              ▼
        cli/ui/* (사람용 요약 출력)
```

원칙:

- CLI 명령은 정확히 1개의 단계 모듈만 호출한다.
- 단계 모듈끼리는 직접 호출 금지. 통신은 항상 artifact 파일을 통해서만.
- 외부 네트워크/도구 호출은 `integrations/*` 에만 존재.
- `rules/*` 는 순수 함수: 입력은 diff/파일/메타, 출력은 finding 배열.
- `hooks/*` 는 work/review/apply 단계의 진입·종료 시 트리거되는 보조 로직.

## 6. 핵심 인터페이스 (TypeScript 시그니처)

```ts
// src/artifact/types.ts
export interface ArtifactWriter {
  writeMarkdown(relativePath: string, content: string): Promise<void>;
  writeJson(relativePath: string, data: unknown, schemaId?: string): Promise<void>;
}

export interface ArtifactReader {
  readMarkdown(relativePath: string): Promise<string | null>;
  readJson<T>(relativePath: string, schemaId?: string): Promise<T | null>;
  exists(relativePath: string): Promise<boolean>;
}
```

```ts
// src/rules/types.ts
export type Severity = "info" | "warning" | "high" | "critical";

export interface RuleFinding {
  ruleId: string;
  severity: Severity;
  file?: string;
  line?: number;
  message: string;
}

export interface DeterministicRule {
  id: string;
  describe: string;
  run(ctx: RuleContext): Promise<RuleFinding[]>;
}
```

```ts
// src/hooks/types.ts
export type HookType =
  | "pre-tool" | "post-tool"
  | "pre-apply" | "post-review"
  | "session-start" | "session-end";

export interface Hook {
  id: string;
  type: HookType;
  describe: string;
  run(ctx: HookContext): Promise<HookResult>;
}
```

```ts
// src/integrations/types.ts
export interface ReviewAdapter {
  id: "codex" | "claude" | string;
  available(): Promise<boolean>;
  run(input: ReviewInput): Promise<ReviewResult>;
}

export interface ExportAdapter {
  id: "claude" | "cursor" | "codex" | "generic" | string;
  describe: string;
  export(input: ExportInput): Promise<ExportResult>; // 결정적 변환
}
```

```ts
// src/core/gate/types.ts
export type Verdict =
  | "PASS"
  | "PASS_WITH_WARNINGS"
  | "NEEDS_HUMAN_REVIEW"
  | "BLOCK"
  | "INSUFFICIENT_EVIDENCE";

export interface GateInputs {
  ruleFindings: RuleFinding[];
  reviewResults: ReviewResult[];
  testStatus: "passed" | "failed" | "not_run" | "insufficient";
  riskFlags: {
    dangerousFiles: string[];
    missingTests: boolean;
    hookInjection: boolean;
    agentPermissionExpansion: boolean;
    codexMissingForHighRisk: boolean;
  };
}

export interface GateDecision {
  verdict: Verdict;
  riskLevel: "low" | "medium" | "high" | "critical";
  humanApprovalRequired: boolean;
  reasons: string[];
}
```

## 7. 모듈간 의존성 규칙

```text
cli/commands/*       →  core/<stage>/*       (allowed)
core/<stage>/*       →  artifact/*           (allowed)
core/gate/*          →  rules/*              (allowed, only for gate stage)
core/review/*        →  integrations/*       (allowed, only for review stage)
core/work,review,apply → hooks/*             (allowed)
cli/commands/export  →  integrations/<tool>/export  (allowed)
core/*               →  utils/*              (allowed)

core/<A>             →  core/<B>             (FORBIDDEN: artifact 통신만)
rules/*              →  integrations/*       (FORBIDDEN: deterministic 유지)
rules/*              →  hooks/*              (FORBIDDEN)
artifact/*           →  core/*               (FORBIDDEN: 단방향)
utils/*              →  core/* or cli/*      (FORBIDDEN: 단방향)
integrations/*       →  core/*               (FORBIDDEN: adapter 는 core 를 모름)
```

이 규칙은 `dependency-cruiser` 로 강제한다 (TASKS.md 별도 task).

## 8. JSON Schema 위치 (v3)

- `src/schemas/decision.schema.json` — `.harness/decision.json` (§9)
- `src/schemas/team.schema.json` — `team.json` (harness-design 단계 산출)
- `src/schemas/agent-routing.schema.json` — `agent-routing.json` (team 단계 산출)
- `src/schemas/rules.schema.json` — `rules.json`
- `src/schemas/hooks.schema.json` — `hooks.json`
- `src/schemas/skills-map.schema.json` — `skills-map.json`
- `src/schemas/codex-findings.schema.json` — review 어댑터 출력 정규화
- `src/schemas/eval-case.schema.json` — memory eval-cases

스키마 검증은 `Ajv`. 실패 시 해당 단계 즉시 실패 + verdict 자동 `INSUFFICIENT_EVIDENCE`.

## 9. decision.json 표준 형태 (v3)

본 문서가 단일 출처. `schemaVersion: "0.3"` 으로 명시 (v1 0.1, v2 0.2 와 구분).

```json
{
  "schemaVersion": "0.3",
  "project": "verified-ai-development-harness",
  "taskId": "TASK-001",
  "workflowStage": "gate",
  "verdict": "PASS | PASS_WITH_WARNINGS | NEEDS_HUMAN_REVIEW | BLOCK | INSUFFICIENT_EVIDENCE",
  "riskLevel": "low | medium | high | critical",
  "humanApprovalRequired": true,
  "humanApproved": false,
  "teamArchitecture": {
    "pattern": "Pipeline | Fan-out/Fan-in | Expert Pool | Producer-Reviewer | Supervisor | Hierarchical Delegation",
    "agents": [],
    "orchestrator": ".harness/orchestrator.md"
  },
  "qualityPolicy": {
    "rules": ".harness/rules.json",
    "hooks": ".harness/hooks.json",
    "contextPolicy": ".harness/context-policy.md",
    "status": "applied | missing | violated",
    "violations": []
  },
  "tests": {
    "status": "passed | failed | not_run | insufficient",
    "commands": [],
    "summary": ""
  },
  "reviewAdapters": [
    {
      "adapterId": "codex",
      "status": "passed | warnings | failed | not_run",
      "findingsCount": 0,
      "criticalFindings": 0,
      "summary": ""
    }
  ],
  "deterministicRules": {
    "status": "passed | failed",
    "triggeredRules": []
  },
  "evidence": {
    "intake": ".harness/intake.md",
    "clarify": ".harness/clarify.md",
    "context": ".harness/context.md",
    "spec": ".harness/SPEC.md",
    "plan": ".harness/PLAN.md",
    "tasks": ".harness/TASKS.md",
    "harnessDesign": ".harness/harness-design.md",
    "qualityPolicy": ".harness/quality-policy.md",
    "teamRuntime": ".harness/team-runtime.md",
    "selfReview": ".harness/self-review.md",
    "codexReview": ".harness/codex-review.md",
    "report": "REPORT.md"
  },
  "apply": {
    "allowed": false,
    "reason": ""
  },
  "generatedAt": "2026-05-18T00:00:00Z"
}
```

v3 변경점 주석:

- `teamArchitecture` 필드 추가 (harness-design 결과를 verdict 출력에 명시).
- `qualityPolicy` 필드 신설 (v2 `qualityProfile` 의 후신, 구조 분리).
- 원본 사양의 단일 `codexReview` 는 `reviewAdapters[]` 배열로 일반화 (독립성 보장: 단일 어댑터가 의사결정 절반 차지 금지).
- `workflowStage` 필드 추가 (decision 이 어느 단계에서 만들어졌는지 명시).

## 10. apply 차단 알고리즘

`harness apply --approved` 호출 시 다음 순서로만 통과.

```text
1. .harness/decision.json 존재?              아니면 exit(2)
2. schema 검증 통과?                         아니면 exit(2) + verdict 강제 INSUFFICIENT_EVIDENCE
3. verdict ∈ {PASS, PASS_WITH_WARNINGS}?
   - 아니라면, verdict === NEEDS_HUMAN_REVIEW 이고
     모든 humanApprovalRequired finding 이 .harness/approval.txt 의 토큰과 매칭?
       그렇다면 통과
       아니라면 exit(3)
   - verdict ∈ {BLOCK, INSUFFICIENT_EVIDENCE}? 어떤 플래그로도 차단. exit(4)
4. pre-apply hook 실행 (실패 시 거부)
5. apply 모듈이 변경 적용 후 .harness/apply-log.md 기록
6. post-review hook 트리거 (선택)
```

자동 commit/push/deploy 는 어느 분기에서도 발생하지 않는다.

## 11. export adapter 의 위치와 제약 (v3 신규)

`.claude/`, `.cursor/`, `.codex/` 디렉터리는 본 도구가 **읽지 않는다**. 오직 export 모듈만 **쓴다**.

```text
.harness/team.json       ──▶ integrations/claude/export.ts  ──▶  .claude/agents/*.md
.harness/skills-map.json ──▶ integrations/claude/export.ts  ──▶  .claude/skills/*.md
.harness/quality-policy.md ─▶ integrations/claude/export.ts ──▶  CLAUDE.md (포인터)
```

규칙:

- export 는 **단방향**. `.claude/` 변경이 `.harness/` 로 역류하는 경로는 MVP 비범위.
- export 는 **결정적**. 동일 입력 → 동일 출력. 시간/랜덤 의존 금지.
- export 가 실패해도 core gate 는 영향을 받지 않는다.
- export adapter 의 부재로 인해 core 명령(plan/design/policy/gate/apply)이 거부되어서는 안 된다.

## 12. 런타임과 패키지 선택

| 항목 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript 5.x | strict 모드, schema 강제 용이 |
| 런타임 | Node.js 20 LTS | 안정적 ESM·내장 test runner |
| CLI 파서 | `commander` 또는 `clipanion` | oclif 회피, 가벼움 |
| JSON Schema | `ajv` + `ajv-formats` | 표준·성능·증거 |
| 파일 IO | `node:fs/promises` | 외부 의존 최소화 |
| 테스트 | `node:test` + `tsx` | 외부 러너 의존 최소화 |
| diff | `node:child_process` + `git diff` (fallback `diff` 패키지) | 단순 |
| 색·표 | `picocolors`, `cli-table3` | 가벼움 |
| 의존성 검사 | `dependency-cruiser` | §7 규칙 강제 |

`ReviewAdapter` 와 `ExportAdapter` 는 MVP 에서 stub. 실제 LLM/도구 호출은 Phase D.

## 13. 실패 모드와 의도된 거부

| 상황 | 의도된 행동 | exit |
|---|---|---|
| `harness work` 시 `TASKS.md` 또는 `agent-routing.json` 없음 | 선행 단계 안내 거부 | 10 |
| `harness gate` 시 `worklog.md` 또는 quality-policy artifact 부재 | 거부 | 10 |
| `harness apply` 시 `decision.json` 없음 | 거부 | 2 |
| schema 검증 실패 | verdict 강제 INSUFFICIENT_EVIDENCE, apply 차단 | 2 |
| verdict BLOCK | apply 거부 | 4 |
| codex-missing-risk 발화 (고위험 변경 + codex 미실행) | verdict ≤ NEEDS_HUMAN_REVIEW | (gate 산출, apply 시 3 또는 4) |
| 외부 review adapter 미설정 + 강제 PASS 시도 | 거부, deterministic 단독 PASS 불가 | 5 |
| `harness export <unknown>` | 알 수 없는 어댑터 거부 | 1 |
| `harness export claude` 실행 시 `.harness/team.json` 없음 | 선행 단계(design) 안내 거부 | 10 |

위 행동은 모두 통합 테스트로 증명된다 (SECURITY.md §7, TASKS.md T-SEC-*).

## 14. 비-아키텍처 결정 (NADs)

- **DB 없음** — `.harness/` 파일 시스템이 곧 저장소.
- **데몬/서버 없음** — 1회 실행 CLI 만.
- **core 에서 LLM 직접 호출 안 함** — adapter 를 통해서만.
- **TypeScript 외 언어 미지원 (MVP)** — 룰 휴리스틱이 언어 특화.
- **자동 PR 생성 없음** — PRODUCT §7.2 위배.
- **`.claude/` 우선 사상 거부** — `.harness/` 가 1급, `.claude/` 는 export 결과 (v3 핵심).
- **harness-design 과 team 통합 거부** — 설계 변경이 실행에 즉시 새지 않게 분리 (v3 핵심).

## 15. 확장 포인트

- `rules/*` 추가 — 디렉터리에 파일 추가만 하면 gate 가 자동 로드.
- `hooks/*` 추가 — 동일.
- `integrations/<tool>/export.ts` 추가 — 새 도구 export 지원.
- `core/harness-design/patterns/<new>.ts` 추가 — 신규 팀 패턴 도입 (HARNESS-DESIGN.md 참고).
- `schemas/*` 진화 — `schemaVersion` 필드로 호환성 관리.

## 16. 본 문서가 답하지 않는 것

- "어떤 위협 모델을 가정하나" → SECURITY.md
- "단계 간 인터랙션 시퀀스" → WORKFLOW.md
- "팀 패턴 6종의 선택 기준" → HARNESS-DESIGN.md
- "rules/hooks/context 의 묶음 정책" → QUALITY-POLICY.md
- "구체적 CLI 인자" → CLI.md
- "MVP 일정" → ROADMAP.md
- "구현 task 목록" → TASKS.md
