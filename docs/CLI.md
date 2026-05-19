# CLI — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 WORKFLOW.md §3 의 14개 단계를 사용자가 호출할 수 있는 명령으로 노출한다. ARCHITECTURE.md §3 의 `src/cli/commands/*.ts` 와 1:1 대응한다.

## 1. 전체 명령 목록

```text
harness init
harness ask "<goal>"
harness context
harness spec
harness plan
harness design
harness policy
harness team
harness work <task-id>
harness review
harness gate
harness apply --approved
harness report
harness export <tool>        # tool ∈ {claude, cursor, codex, generic}
```

14개. PRODUCT.md §11 "비-성공 시나리오" 의 "CLI 명령어가 18개를 넘는다" 상한 내.

## 2. 공통 동작

### 2.1 작업 디렉터리 (cwd)

모든 명령은 cwd 의 `.harness/` 를 작업 공간으로 본다. `HARNESS_HOME` 또는 `--workspace <path>` 로 변경 가능.

### 2.2 공통 플래그

| 플래그 | 의미 |
|---|---|
| `--workspace <path>` | `.harness/` 위치 명시 |
| `--json` | 사람용 출력 대신 JSON 한 줄 stdout |
| `--quiet` | 비필수 출력 억제 |
| `--no-color` | 색 출력 비활성 |
| `--version` | 버전 표시 후 종료 |
| `--help` | 명령별 도움말 |

### 2.3 exit code 규약

ARCHITECTURE §13 의 실패 모드 표와 일치.

| exit | 의미 |
|---|---|
| 0 | 성공 |
| 1 | 일반 오류 (사용자 입력 미스 포함) |
| 2 | 필수 artifact 누락 또는 schema 검증 실패 |
| 3 | Human Gate 토큰 부재 (NEEDS_HUMAN_REVIEW 미승인) |
| 4 | verdict BLOCK 또는 INSUFFICIENT_EVIDENCE 에서 apply 시도 |
| 5 | 어댑터 미설정 + 자동 PASS 강제 시도 |
| 10 | 선행 단계 미수행 |
| 11 | 단계 중복 호출 / 동일 task 재실행 |
| 70 | 내부 일관성 위반 |

### 2.4 출력 채널

- `stdout` : 사람용 또는 `--json` JSON.
- `stderr` : 거부 사유·경고.
- 파일 : `.harness/` 산출물 (WORKFLOW §3 참고).
- 감사 : `.harness/audit.jsonl` (SECURITY §9).

## 3. 명령별 상세

### 3.1 `harness init`

```text
harness init [--force]
```

- `.harness/` 디렉터리와 기본 설정 생성.
- 파일 : `.harness/config.json`, `.harness/audit.jsonl`(빈), `.harness/.gitignore`(`approval.txt`, `config.json` 등 무시).
- 거부 : `.harness/` 이미 존재 + `--force` 미지정 → exit 11.

### 3.2 `harness ask "<goal>"`

```text
harness ask "<goal>" [--no-clarify]
```

- intake + clarify 트리거.
- 파일 : `.harness/intake.md`, (옵션) `.harness/clarify.md`.
- 거부 : `.harness/` 미초기화 → 10, `<goal>` 누락 → 1.

### 3.3 `harness context`

```text
harness context [--from <file>]
```

- 도메인·구조·제약 정리. context.md 6섹션 lint.
- 파일 : `.harness/context.md`.
- 거부 : `clarify.md` 없음 → 10.
- v3 신규 단독 명령 (v1·v2 에서는 spec 의 선행 자동 단계).

### 3.4 `harness spec`

```text
harness spec [--non-interactive] [--answers <file>]
```

- Gstack식 7문항 강제 → SPEC.md.
- **interactive 모드 (TTY)** : 명령 호출 시 7문항을 `readline` 으로 순서대로 받음 (Phase C 후속에서 활성화).
- **non-interactive 모드** : `--non-interactive` 와 함께 `--answers <file>` (JSON) 필수. TTY 가 아니면 자동 fallback.
- 거부 : `context.md` 없음 → 10. 빈/TBD 답변 → 1. 비-TTY + `--answers` 부재 → 1.

### 3.5 `harness plan`

```text
harness plan [--max-tasks <n>] [--require-tests]
```

- PLAN.md + TASKS.md 8컬럼 lint.
- 거부 : `SPEC.md` 없음 → 10.

### 3.6 `harness design` (v3 신규)

```text
harness design [--pattern <name>] [--auto]
```

- HARNESS-DESIGN.md 의 의사결정 트리에 따른 팀 패턴 선택.
- 옵션 :
  - `--pattern <name>` : 사용자가 명시 선택 (Pipeline | Fan-out/Fan-in | Expert Pool | Producer-Reviewer | Supervisor | Hierarchical Delegation).
  - `--auto` : 도구가 도메인·plan 을 보고 추천 후 사용자 확인.
- 파일 : `.harness/harness-design.md`, `team.json`, `orchestrator.md`, `skills-map.json`.
- 거부 :
  - `PLAN.md`/`TASKS.md` 없음 → 10.
  - 알 수 없는 `--pattern` → 1.
  - lint(HARNESS-DESIGN §11) 위반 → 10.

### 3.7 `harness policy` (v3 신규)

```text
harness policy [--inherit <profile>] [--from <plan-path>]
```

- ECC식 묶음 선택 → 4개 산출.
- 파일 : `.harness/quality-policy.md`, `rules.json`, `hooks.json`, `context-policy.md`.
- `--inherit` : 기존 정책 재사용 + 변경분만.
- 거부 :
  - `harness-design.md` 없음 → 10.
  - 화이트리스트 외 hook command → 1.
  - lint(QUALITY-POLICY §11) 위반 → 10.

### 3.8 `harness team`

```text
harness team
```

- 실행 routing 생성.
- 파일 : `.harness/team-runtime.md`, `agent-routing.json`.
- 거부 :
  - `team.json` 또는 `rules.json`/`hooks.json` 없음 → 10.
  - `release-gatekeeper` 부재 → 10.
  - 한 agent 가 impl+security 또는 designer+policy 겸직 → 10.

### 3.9 `harness work <task-id>`

```text
harness work <task-id> [--diff-tool <git|builtin>] [--note <text>]
```

- task 1건 구현 로그.
- 동작 :
  1. `TASKS.md` 의 task-id 존재 확인.
  2. `agent-routing.json` 의 `implementation-agent` 소유 확인.
  3. `hooks.json` 의 `pre-tool` blocking hook 실행 (실패 → exit 10).
  4. diff 해시 기록 + `.harness/worklog.md` 항목 추가.
  5. `post-tool` hook 트리거.
- 거부 :
  - 동일 id 가 `completed` 로 이미 기록 → 11.
  - 선행 단계 부재 → 10.

### 3.10 `harness review`

```text
harness review [--adapter <id|all|none>] [--skip-self]
```

- self-review + 외부 ReviewAdapter.
- `--adapter all` (기본) / `<id>` / `none`.
- 파일 : `.harness/self-review.md`, `codex-review.md`, `codex-findings.json`.
- 거부 : `worklog.md` 없음 → 10.

### 3.11 `harness gate`

```text
harness gate [--no-review-adapter]
```

- verdict 산출 + REPORT.md + decision.json.
- `--no-review-adapter` : 어댑터 무시. verdict 상한 PASS_WITH_WARNINGS. 고위험 변경 시 `codex-missing-risk` 자동 발화.
- 거부 : 입력 artifact 부재 → 10. schema 위반 → 2 + 강제 INSUFFICIENT_EVIDENCE.
- 출력 예 :
  ```text
  [verdict] PASS_WITH_WARNINGS
  [rules]   3 triggered (no-test-risk, dangerous-file-write, codex-missing-risk)
  [review]  codex: not_run (어댑터 미설정)
  [tests]   passed (npm test)
  [policy]  qualityPolicy.violations = 0
  [team]    pattern = Producer-Reviewer
  [next]    review REPORT.md → harness apply --approved
  ```

### 3.12 `harness apply --approved`

```text
harness apply --approved [--dry-run]
```

- ARCHITECTURE §10 차단 알고리즘.
- `--approved` 필수. 별칭 없음.
- `--dry-run` : 차단 알고리즘만 실행, 적용 없음.
- 거부 예 :
  ```text
  [refuse] verdict=BLOCK
  [reason] secret-fallback critical finding present.
  [exit]   4
  ```

### 3.13 `harness report`

```text
harness report [--since <stage>]
```

- 현재 단계 + 마지막 verdict + 열린 finding + 다음 추천 명령.
- `--since <stage>` : 지정 단계 이후만 `stagesPresent` 에 포함. 알 수 없는 stage → exit 1.
- 부작용 없음 (read-only).
- `--json` 출력 예 :
  ```json
  {
    "currentStage": "gate",
    "lastVerdict": "PASS_WITH_WARNINGS",
    "teamPattern": "Producer-Reviewer",
    "policySummary": ".harness/quality-policy.md",
    "openFindings": 3,
    "nextSuggested": "harness apply --approved",
    "evidence": { "report": "REPORT.md", "decision": ".harness/decision.json" }
  }
  ```

### 3.14 `harness export <tool>`

```text
harness export claude       # .claude/agents, skills, CLAUDE.md
harness export cursor       # .cursor/rules, context
harness export codex        # .codex/agents, policy.md
harness export generic      # .export/<team|policy>.* + manifest.json
```

- `.harness/` 표준을 외부 도구 형식으로 변환. 4종 모두 활성 (Phase D 후속에서 codex/generic 추가).
- claude :
  - 입력 : `.harness/team.json`, `skills-map.json`, `quality-policy.md`, `orchestrator.md`.
  - 출력 : `.claude/agents/*.md`, `.claude/skills/*.md`, `CLAUDE.md`(포인터).
- cursor :
  - 입력 : `.harness/team.json`, `rules.json`, `quality-policy.md`, `skills-map.json`.
  - 출력 : `.cursor/rules/{quality-policy,applied-rules}.md`, `.cursor/context/<agent>.md`.
- codex :
  - 입력 : `.harness/team.json`, `quality-policy.md`, `skills-map.json`, `orchestrator.md`.
  - 출력 : `.codex/agents/<id>.md`, `.codex/policy.md`.
- generic :
  - 입력 : 위 모두 + `rules.json`, `hooks.json`.
  - 출력 : `.export/<원본 파일 그대로>` + `.export/manifest.json` (어떤 파일이 복사됐는지 기록).
- 거부 :
  - 알 수 없는 tool → 1.
  - 입력 화이트리스트 외 경로 접근 시도 → 70 (보안 위반).
  - `.harness/team.json` 없음 → 10.
- **결정적**: 동일 입력 → 동일 출력. 시간/랜덤 의존 금지.
- **단방향**: 본 명령은 `.claude/`, `.cursor/`, `.codex/`, `.export/` 를 읽지 않는다.

## 4. 종료 코드 우선순위

같은 명령에서 여러 거부 사유가 겹치면 :

```text
70 (내부 일관성) > 4 (apply 차단) > 3 (Human Gate 미승인) > 2 (schema/artifact) > 10 (선행 단계) > 11 (중복) > 5 (어댑터) > 1 (입력) > 0
```

## 5. 동작 매트릭스 (명령 × 선행 artifact)

| 명령 \ 필수 선행 | intake | clarify | context | SPEC | PLAN | TASKS | harness-design | quality-policy | team-runtime | worklog | self-review | decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| init | - | - | - | - | - | - | - | - | - | - | - | - |
| ask | - | - | - | - | - | - | - | - | - | - | - | - |
| context | O | O | - | - | - | - | - | - | - | - | - | - |
| spec | - | - | O | - | - | - | - | - | - | - | - | - |
| plan | - | - | - | O | - | - | - | - | - | - | - | - |
| design | - | - | O | O | O | O | - | - | - | - | - | - |
| policy | - | - | - | - | - | - | O | - | - | - | - | - |
| team | - | - | - | - | - | - | O | O | - | - | - | - |
| work | - | - | - | - | O | O | - | - | O | - | - | - |
| review | - | - | - | - | - | - | - | - | - | O | - | - |
| gate | - | - | - | O | O | O | O | O | O | O | O | - |
| apply | - | - | - | - | - | - | - | - | - | - | - | O |
| report | - | - | - | - | - | - | - | - | - | - | - | - |
| export claude | - | - | - | - | - | - | O | - | - | - | - | - |

O = 해당 artifact 존재 필요. 미충족 시 exit 10.

## 6. `harness --help` 출력 (기준)

```text
harness — Verified AI Development Harness (v0.3, Phase A)

Usage:
  harness <command> [options]

Commands:
  init        Initialize .harness/ workspace
  ask         Save user goal and trigger clarification
  context     Summarize domain, structure, constraints
  spec        Force 7 Gstack-style questions and write SPEC.md
  plan        Break down into TASKS.md (8 columns)
  design      Choose team architecture pattern (revfactory-style)
  policy      Select rules/hooks/context-policy (ECC-style)
  team        Build execution routing (OMC-style)
  work        Log implementation of a single task
  review      Run self-review + codex-review adapters
  gate        Compute verdict, write REPORT.md and decision.json
  apply       Apply changes only if verdict + human approval ok
  report      Print current stage and verdict in human form
  export      Export .harness/ to external tool format (claude|cursor|codex|generic)

Global options:
  --workspace <path>   override .harness/ location
  --json               machine-readable output
  --quiet              suppress non-essential output
  --no-color           disable colored output
  --version            print version
  --help               show this help

For per-command help: harness <command> --help
```

## 7. 인터랙티브 vs 비인터랙티브 정책

- 기본은 TTY 감지. TTY 아니면 자동 `--non-interactive` 폴백.
- 비인터랙티브에서 답변 필요한 단계(spec) 는 `--answers <file>` 없으면 exit 1.
- CI 권장 흐름 :
  ```bash
  harness init
  harness ask "<goal>"
  harness context --from ./.harness-inputs/context.md
  harness spec --non-interactive --answers ./.harness-inputs/spec.md
  harness plan --require-tests
  harness design --pattern Producer-Reviewer
  harness policy --inherit ./.harness-inputs/policy-base.md
  harness team
  harness work TASK-001
  harness review
  harness gate
  # apply 는 CI 자동 호출하지 않는 것을 권장 (Human Gate 본질)
  ```

## 8. export adapter 의 CLI 정책 (v3 신규)

- export 는 별도 서브커맨드(`harness export <tool>`).
- export 실패는 core gate 결과에 영향 없음.
- export 결과물의 위치는 어댑터별 화이트리스트로 고정.
  - `claude` : `.claude/agents/`, `.claude/skills/`, `CLAUDE.md`.
  - `cursor` : `.cursor/rules/`, `.cursor/context/`.
  - `codex` : `.codex/agents/` (스펙은 Phase D 에서 확정).
  - `generic` : `.export/<tool>/` (실험용).

## 9. 본 문서가 답하지 않는 것

- 명령 산출물의 형식 → WORKFLOW.md
- 어떤 룰이 어떤 verdict 를 트리거하는가 → SECURITY.md
- 팀 패턴 선택 기준 → HARNESS-DESIGN.md
- rules/hooks 묶음 결정 → QUALITY-POLICY.md
- 명령 구현 모듈 위치 → ARCHITECTURE.md
- 명령 구현 task 분해 → TASKS.md
