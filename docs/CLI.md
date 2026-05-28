# CLI — Verified AI Development Harness (v3)

> 버전 0.5 · 2026-05-20 · 본 문서는 WORKFLOW.md §3 의 14개 단계 + Phase QF + Phase WF/RP + self-host 단축을 사용자가 호출할 수 있는 명령으로 노출한다. ARCHITECTURE.md §3 의 `src/cli/commands/*.ts` 와 1:1 대응한다.

## 1. 전체 명령 목록

### 1.1 M1 14단계 (intake → memory)

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

### 1.2 Phase QF — Quality Factory (v0.4)

```text
harness contract --template <web-ui|cli-tool|backend-api|library|custom>
harness memory add --kind <K> --summary <S>
harness benchmark [--group <name>]
harness run --mode <fast|safe|release>
```

### 1.3 Phase WF — Worker Factory (v0.5)

```text
harness workers <init|list|status|validate>
harness packet <task-id> [--tool <generic|codex|claude|cursor|all>] [--dispatch]
harness dispatch <task-id> --worker <role>
harness worker-result <import|list|show>
```

### 1.4 Phase RP — Rule/Skill Pack (v0.5)

```text
harness rule-pack <list|enable|disable|status|audit>
harness skill-pack <list|enable|disable|status|audit>
```

### 1.5 자가 검증 / demo (v0.4 후속 + v0.5 DX)

```text
harness self-host [--goal <text>] [--task-id <id>] [--with-worker-stubs]
harness demo [safety|productivity] [--task <id>] [--clean]
harness auto <goal> [--task <id>]
harness promote <subcommand>
```

총 29개 (상위 명령 기준 — subcommand 포함 시 더 많음). PRODUCT.md §11 "비-성공 시나리오" 의 "CLI 명령어가 30개를 넘는다" 상한 내.

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
harness init [--force] [--preset <cli-tool|web-ui|backend-api|library>]
```

- `.harness/` 디렉터리와 기본 설정 생성.
- 파일 : `.harness/config.json`, `.harness/audit.jsonl`(빈), `.harness/.gitignore`(`approval.txt`, `config.json` 등 무시).
- `--preset` (v0.5 Phase UX): workers (profile=standard/strict) + rule-packs default + skill-packs default + quality-contract (placeholder productIntent) 자동 시드. 자동 apply 또는 자동 코드 변경은 하지 않음.
- 거부 : `.harness/` 이미 존재 + `--force` 미지정 → exit 11. 알 수 없는 preset → exit 1.

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

- 소스·문서·테스트·스크립트·위험파일 자동 스캔 + 작업 goal 기반 관련 파일 후보를 정리한다.
- `--from <file>`: 사용자가 작성한 추가 맥락을 `User-provided Context` 섹션으로 반영한다.
- 파일 : `.harness/context.md` (사람용) + `.harness/source-map.json` (machine-readable, schema 검증) + `.harness/source-map.md` (사람용 요약).
- 다른 stage(packet, dispatch 등) 는 `source-map.json` 을 재사용해 동일한 프로젝트 스냅샷에서 일관된 작업을 수행한다.
- 거부 : `clarify.md` 없음 → 10, `--from` 파일 없음 → 1.
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
- `--adapter none` (기본: self-review만) / `all` / `<id>`.
- 외부 검증은 `--adapter codex`, `--adapter claude`, 또는 `--adapter all` 을 명시해야 실행된다.
- 파일 : `.harness/self-review.md`, `codex-review.md`, `codex-findings.json`.
- 거부 : `worklog.md` 없음 → 10.

### 3.11 `harness gate`

```text
harness gate [--no-review-adapter] [--strict]
```

- verdict 산출 + REPORT.md + decision.json.
- `--no-review-adapter` : 어댑터 무시. `reviewStatus` 를 not_run 으로 강제 → verdict 상한 PASS_WITH_WARNINGS. 고위험 변경 시 `codex-missing-risk` 자동 발화.
- `--strict` : verdict 가 clean PASS 가 아니면 non-zero exit (BLOCK/INSUFFICIENT_EVIDENCE=4, NEEDS_HUMAN_REVIEW/PASS_WITH_WARNINGS=3) — CI 게이팅용. 기본 모드(strict 미지정)는 exit 0 유지.
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
- decision.json content hash 를 audit 결박값과 대조 → gate 이후 변조 시 거부. NEEDS_HUMAN_REVIEW 의 `.harness/approval.txt` 토큰은 현재 decision hash 에 바인딩(재사용·드리프트 차단).
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

### 3.15 `harness contract` (v0.4 신규, Phase QF)

```text
harness contract --template <web-ui|cli-tool|backend-api|library|custom>
                 --task <task-id>
                 [--answers <file>]
                 [--non-interactive]
```

- `work` 진입 전 강제. 5 template 의 기본 qualityBars + productIntent 7문항.
- 산출: `.harness/quality-contract.json`, `.harness/QUALITY-CONTRACT.md`.
- 거부: invalid template → 1, productIntent placeholder → 10.

### 3.16 `harness memory add` (v0.4 신규)

```text
harness memory add --kind <K> --summary <text> [--rule <id>] [--task <id>]
```

- `K ∈ {false_positive, false_negative, missed_risk, useful_rule, noisy_rule, improved_prompt, changed_workflow, milestone_passed}`.
- 산출: `.harness/eval-cases/<id>.json` + `.harness/memory.md` append.

### 3.17 `harness benchmark` (v0.4 신규)

```text
harness benchmark [--group <name>]
```

- `fixtures/<group>/<scenario>/{last-diff.patch,expected.json}` 스캔.
- 산출: `.harness/benchmark-report.md`, `benchmark-results.json` (critical recall / FP rate).
- release mode gate 가 본 결과 강제.

### 3.18 `harness run --mode` (v0.4 신규)

```text
harness run --mode <fast|safe|release> [goal]
```

- 모드별 권장 명령 시퀀스 안내 (실행 미포함). release 는 benchmark 강제.

### 3.19 `harness self-host` (v0.4 후속)

```text
harness self-host [--goal <text>] [--task-id <id>] [--with-worker-stubs]
```

- tmpdir 격리 워크스페이스에 14단계 + WF/RP 자동 시드 + gate 까지.
- `--with-worker-stubs`: 3 worker (impl/test/sec) 의 result.{md,json} 자동 stub.
- 실 repo `.harness/audit.jsonl` 무영향.

### 3.20 `harness demo` (v0.5, Phase DX)

```text
harness demo [safety|productivity] [--task <id>] [--clean]
```

- `productivity`: 기존 소스 fixture 를 읽고 context, task packet, worker prompt 를 생성한다.
- `safety`: AI 가 fallback secret 을 추가한 위험 diff fixture 를 만들고 `secret-fallback` rule 이 BLOCK 하는 장면을 보여준다.
- 실제 caller repo 에 apply/commit/push/deploy 를 하지 않는다.
- `--clean`: 결과 경로를 출력한 뒤 임시 워크스페이스를 삭제한다.

### 3.21 `harness packet <task-id>` (v0.5, source packet)

```text
harness packet <task-id> [--tool <generic|codex|claude|cursor|all>] [--dispatch] [--profile <minimal|standard|strict>]
```

- 기존 source context, intake goal, SPEC, PLAN, TASKS 를 묶어 `.harness/task-packets/<task-id>.md` 를 생성한다.
- `--tool codex|claude|cursor`: 해당 AI 도구에 바로 붙여넣기 쉬운 패킷을 `.codex.md`, `.claude.md`, `.cursor.md` 로 생성한다.
- `--tool all`: generic + Codex + Claude + Cursor 패킷을 모두 생성한다.
- `--dispatch`: workers.json 기준으로 worker prompt 도 함께 생성하고 packet 에 prompt 경로를 포함한다.
- 검증 도구가 아니라 AI 작업 전 맥락 전달을 빠르게 만드는 생산성 진입점이다.

### 3.22 `harness auto <goal>` (v0.5, Phase WF-3)

```text
harness auto <goal> [--task <id>] [--adapter <codex|codex-stub>] [--max-cost <USD>] [--strict]
```

- 14단계 공정을 자동 진행하고 gate/Human Gate에서 정지한다.
- AI 작업 + 독립 review adapter + deterministic gate를 오케스트레이션하지만 apply는 자동 실행하지 않는다.

### 3.23 `harness workers <subcommand>` (v0.5 신규, Phase WF)

```text
harness workers init --profile <minimal|standard|strict> [--force]
harness workers list
harness workers status
harness workers validate
```

- `workers.json` (profile + 8 worker role + roleSeparation) 관리.
- `validate`: role separation 위반 시 exit 10.

### 3.24 `harness dispatch` (v0.5 + Phase WF-2)

```text
harness dispatch <task-id> --worker <role>
harness dispatch <task-id> --all [--profile <minimal|standard|strict>]
```

- 단일 worker: prompt 생성 (`.harness/worker-runs/<task>/<role>.prompt.md`).
- `--all`: workers.json 의 profile required 전체 worker 에 대해 prompt + `worker-run-manifest.json` + `worker-handoff.md` 생성.
- worker 가 직접 result.md/json 작성 후 `harness worker-result import` 로 회수.

### 3.25 `harness worker-result <subcommand>` (v0.5 + Phase WF-2)

```text
harness worker-result import <task-id> --worker <role> --file <result.md> [--json <result.json>]
harness worker-result list <task-id>
harness worker-result show <task-id> --worker <role>
harness worker-result validate <task-id> [--profile <name>]
```

- `import` 시 body 의 forbidden action 패턴 자동 검사 → critical finding 자동 추가.
- `validate`: required worker / schema / role / finding / evidence 경로 검증 → `.harness/worker-result-validation.{md,json}`. fail 시 exit 10.

### 3.26 `harness rule-pack <subcommand>` (v0.5 신규, Phase RP)

```text
harness rule-pack list
harness rule-pack enable <pack>
harness rule-pack disable <pack>
harness rule-pack status
harness rule-pack audit
```

- 13 pack 큐레이션 (security-core, test-discipline, architecture-core, design-web, release-strict, ai-generated-code-risk, worker-safety-core, quality-contract-core + Phase RP-2 5종).
- gate 가 enabledPacks 와 template requiredPacks 비교 → INSUFFICIENT_EVIDENCE 강등.

### 3.27 `harness skill-pack <subcommand>` (v0.5 신규)

```text
harness skill-pack list
harness skill-pack enable <pack>
harness skill-pack disable <pack>
harness skill-pack status
harness skill-pack audit
```

- 13 pack 큐레이션 (typescript-quality / backend-api-quality / web-ui-quality / cli-tool-quality / library-quality / release-readiness / evidence-writing + Phase RP-2 신규 6: testing-quality / security-review-writing / architecture-review-writing / release-note-writing / migration-writing / external-review-prep).
- skill pack 누락은 직접 BLOCK 아님 — PASS_WITH_WARNINGS 압력.

### 3.28 `harness doctor` (v0.5 + Phase UX)

```text
harness doctor [--json]
```

- 환경 + `.harness/` 워크스페이스 12 항목 진단 (Node 버전, git, package.json, node_modules, test script, fixtures, workers.json, rule-packs.json, skill-packs.json, quality-contract.json 등).
- 산출: `.harness/doctor-report.{md,json}` (`.harness/` 존재 시).
- `--json`: stdout 으로 JSON 한 줄. 자동화 친화적.
- 비-목표: 자동 fix 시도 없음. fix hint 만 제공.

### 3.29 `harness promote <subcommand>` (Promotion Gate)

```text
harness promote submit <id> --module <path> --export <name>
harness promote trial <id>
harness promote approve <id> --approved
harness promote list
harness promote submit-pack <id> --file <skill-pack.json>
harness promote approve-pack <id> --approved
```

- 후보 deterministic rule 또는 skill pack 을 시험하고 사람 승인 후 promoted catalog 에 채용한다.
- 채용 과정은 ledger 와 promoted manifest 로 남긴다.

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
| packet | - | - | O | - | - | - | - | - | - | - | - | - |
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
  packet      Build an AI work packet
  work        Log implementation of a single task
  review      Run self-review + codex-review adapters
  gate        Compute verdict, write REPORT.md and decision.json
  apply       Apply changes only if verdict + human approval ok
  report      Print current stage and verdict in human form
  export      Export .harness/ to external tool format (claude|cursor|codex|generic)
  memory      Add learning/evaluation memory
  contract    Create a quality contract
  benchmark   Run fixture benchmark
  run         Print recommended mode sequence
  self-host   Run a self-check in an isolated workspace
  demo        Run an isolated safety/productivity demo
  auto        Run the factory workflow and stop before apply
  workers     Manage Worker Factory config
  dispatch    Create worker prompts
  worker-result
              Import/list/show/validate worker evidence
  rule-pack   Manage deterministic rule packs
  skill-pack  Manage worker guidance skill packs
  doctor      Diagnose the local harness workspace
  promote     Promote candidate rules and skill packs

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
