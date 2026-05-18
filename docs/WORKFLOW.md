# WORKFLOW — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 PRODUCT.md §7 "단계 분리 보장" 을 14개 단계의 시퀀스로 풀어낸 실행 매뉴얼이다. ARCHITECTURE.md §4 모듈 매핑과 1:1 대응한다.

## 1. 전체 시퀀스

```text
intake → clarify → context → spec → plan
       → harness-design → quality-policy → team
       → work → self-review → codex-review
       → gate → apply → memory
```

각 단계는 다음 두 조건을 동시에 만족해야 다음 단계로 진행한다.

1. **선행 artifact 존재** — 이전 단계가 정의된 `.md` / `.json` 산출물을 만들었는가.
2. **선행 단계 schema 검증 통과** — 산출물이 ARCHITECTURE.md §8 의 schema 를 만족하는가.

미충족 시 CLI 는 거부, exit code 10 (ARCHITECTURE.md §13).

## 2. v2 → v3 단계 변화

```text
v2:  spec → quality-profile → plan → team
v3:  spec → plan → harness-design → quality-policy → team
```

이유:

- **plan 이 quality-policy 보다 먼저** — "무엇을 어떻게 쪼갤지" 를 정하지 않은 채 "어떤 정책으로 일할지" 를 정할 수 없다. plan 이 입력, policy 가 출력 정책.
- **harness-design 신규 분리** — "어떤 팀 구조로 일할지" 를 quality-policy 와 team 사이가 아니라 plan 과 quality-policy 사이로 배치. 도메인 분석과 plan 결과를 보고 팀 패턴을 고른 뒤, 그 팀에 맞는 정책을 묶는다.
- **team 단계 의미 변화** — v2 의 team 은 "역할 분담 정의" 였다. v3 에서는 harness-design 이 그 역할을 가져갔고, team 은 **실행 routing 과 handoff** 만 담당.

## 3. 단계별 상세

### 3.1 intake — 원문 보존

- **명령** : `harness ask "<goal>"`
- **책임** : 사용자 원문을 가공 없이 저장.
- **출력** : `.harness/intake.md` (원문, 날짜, 요청 유형, 예상 위험도, 초기 목표)
- **전이 조건** : 파일 존재 + 비어 있지 않음.
- **금지 사항** : LLM 으로 의도를 "정리" 하거나 "재작성" 하지 않음.

### 3.2 clarify — 질문 생성

- **명령** : `harness ask` 후속 또는 `harness spec` 선행으로 자동.
- **책임** : 6축 질문 강제.
  - 사용자 대상
  - 해결하려는 문제
  - 성공 기준
  - 하지 않을 것
  - 위험 요소
  - 배포/적용 범위
- **출력** : `.harness/clarify.md`
- **전이 조건** : 6축 각 1개 이상 질문 + 답변 칸 존재.
- **금지 사항** : yes/no 단답형만 묻는 질문 거부.

### 3.3 context — 도메인·구조 정리

- **명령** : `harness context`
- **책임** : 다음 6항목 정리.
  - 도메인 용어
  - 기존 코드 구조
  - 관련 파일
  - 외부 의존성
  - 보안 제약
  - 테스트 제약
- **출력** : `.harness/context.md`
- **전이 조건** : 6섹션 모두 존재 (값 "해당 없음" 허용).
- **v3 변경점** : v1·v2 에서는 spec 선행으로 자동이었으나 v3 에서는 **독립 명령** 으로 승격. 도메인 분석이 harness-design 의 입력이기 때문.

### 3.4 spec — 제품 스펙 압축 (Gstack)

- **명령** : `harness spec`
- **책임** : 7문항 강제 답변 → `SPEC.md`.
  1. 누가 쓰는가?
  2. 왜 필요한가?
  3. 없으면 어떤 문제가 생기는가?
  4. 핵심 기능은 무엇인가?
  5. 이번 버전에서 하지 않을 것은 무엇인가?
  6. 성공 기준은 무엇인가?
  7. **실패 기준은 무엇인가?** (v3 신규)
- **출력** : `.harness/SPEC.md`
- **전이 조건** : 7문항 모두 답변 ≥1문장.
- **금지 사항** : "TBD"/"?"/"추후 결정" 만 적은 답변 거부.

### 3.5 plan — 작업 분해 (Superpowers)

- **명령** : `harness plan`
- **책임** : 작은 task 분해 + 8필드.
- **출력** : `.harness/PLAN.md`, `.harness/TASKS.md`
- **TASKS.md 컬럼** : `id`, `title`, `depends`, `acceptance`, `tests`, `rollback`, `expectedFiles`, `doneCriteria`
- **전이 조건** : task ≥1, 각 행 8컬럼 모두 비어 있지 않음.
- **금지 사항** : 단일 task 가 "전체 기능 구현" 인 거대 단위 거부.

### 3.6 harness-design — 팀 아키텍처 설계 (revfactory/harness, v3 신규)

- **명령** : `harness design`
- **책임** : 도메인·plan 을 보고 팀 패턴 선택.
- **수행할 것** :
  - 프로젝트 도메인 분석
  - 필요한 agent role 선정
  - **팀 아키텍처 패턴 선택** (HARNESS-DESIGN.md §3 참고)
    - Pipeline
    - Fan-out/Fan-in
    - Expert Pool
    - Producer-Reviewer
    - Supervisor
    - Hierarchical Delegation
  - orchestrator 설계
  - 각 agent 의 skill/rule/hook 후보 연결 (실제 묶음은 다음 단계)
  - 병렬/순차 영역 분리
  - review path 설계
- **출력** :
  - `.harness/harness-design.md` — 사람 친화 설명
  - `.harness/team.json` — 11 role 중 채택된 부분 + 패턴
  - `.harness/orchestrator.md` — handoff 흐름도
  - `.harness/skills-map.json` — agent ↔ skill 매핑 후보
- **전이 조건** : 4개 산출물 모두 존재, schema 통과.
- **주의** : `.claude/agents/`, `.claude/skills/` 는 본 단계에서 **만들지 않는다**. export adapter 만 만든다.

### 3.7 quality-policy — 품질 운영층 (ECC)

- **명령** : `harness policy`
- **책임** : harness-design 결과에 맞춰 rules·hooks·context·security policy 묶음 선택.
- **포함할 것** :
  - 적용할 rules (언어/프레임워크별)
  - 적용할 hooks (pre-tool · post-tool · pre-apply · post-review · session-start · session-end)
  - search-first / test-first / security-first / review-first 정책
  - 위험 파일 변경 정책
  - context loading 정책
- **출력** :
  - `.harness/quality-policy.md`
  - `.harness/rules.json`
  - `.harness/hooks.json`
  - `.harness/context-policy.md`
- **전이 조건** : 4개 산출물 모두 schema 통과.
- **금지 사항** : ECC 전체 카탈로그 복제. 본 단계는 **묶음 선택** 이지 신규 카탈로그 생성이 아님.

### 3.8 team — 실행 routing (OMC)

- **명령** : `harness team`
- **책임** : harness-design 의 team.json + quality-policy 의 rules/hooks 를 보고 **실제 실행 시 누가 어떤 task 를 어떤 handoff 로 처리하는가** 결정.
- **출력** :
  - `.harness/team-runtime.md` — 사람용
  - `.harness/agent-routing.json` — 기계용 routing 표
- **기본 role 11종** (재선언) :
  - product-questioner, domain-analyst, architect, **harness-designer (v3)**, **quality-policy-designer (v3)**, implementation-agent, test-agent, refactor-agent, security-reviewer, **codex-review-coordinator (v3)**, release-gatekeeper
- **전이 조건** :
  - `release-gatekeeper` 역할 반드시 존재.
  - `implementation-agent` 와 `security-reviewer` 가 동일 ID 가 아닐 것 (독립성 보장).
  - `harness-designer` 와 `quality-policy-designer` 가 동일 ID 가 아닐 것 (설계·정책 분리).

### 3.9 work — 구현

- **명령** : `harness work <task-id>`
- **책임** : 지정 task 만 구현. 한 호출 = 1 task.
- **출력** :
  - 실제 코드 변경
  - `.harness/worklog.md` 항목 추가
- **규칙** :
  - `agent-routing.json` 의 `implementation-agent` 가 task 소유.
  - 변경 전후 diff 해시 기록.
  - 테스트 없는 기능 변경 → `no-test-risk` 자동 플래그.
  - auth/secret/deploy/CI/config 변경 → 자동 Human Gate 대상 플래그.
- **금지 사항** : 1회 호출에서 2 task 동시 처리.

### 3.10 self-review — 자기 검토

- **명령** : `harness review` 의 1단계.
- **책임** : 7항목 점검.
  - 요구사항 충족
  - acceptance criteria 충족
  - 테스트 여부
  - edge case
  - 보안 위험
  - 불필요한 복잡도
  - 기존 구조 일관성
  - rollback 가능성
- **출력** : `.harness/self-review.md`
- **금지 사항** : "문제 없음" 만 적힌 review 거부.

### 3.11 codex-review — 독립 검증

- **명령** : `harness review` 의 2단계.
- **책임** : 외부 ReviewAdapter 호출 + 결과 정규화.
- **출력** : `.harness/codex-review.md`, `.harness/codex-findings.json`
- **어댑터 부재 시** : `status: "not_run"` 으로 명시 기록. 감추지 않는다.
- **고위험 변경 + 어댑터 부재** : `codex-missing-risk` 룰 자동 트리거 → gate 에서 verdict ≤ NEEDS_HUMAN_REVIEW.

### 3.12 gate — verdict 산출

- **명령** : `harness gate`
- **책임** : 통합 verdict.
- **verdict 결정 알고리즘 (v3)** :
  ```text
  if 필수 artifact 누락 또는 schema 실패              → INSUFFICIENT_EVIDENCE
  else if deterministic rule critical 존재             → BLOCK
  else if codex-missing-risk + 고위험 변경              → NEEDS_HUMAN_REVIEW (또는 INSUFFICIENT_EVIDENCE)
  else if dangerous-file-write 트리거                   → NEEDS_HUMAN_REVIEW
  else if hook-injection-risk 또는 agent-permission-risk → NEEDS_HUMAN_REVIEW
  else if review adapter critical 또는 tests=failed    → NEEDS_HUMAN_REVIEW
  else if no-test-risk 또는 warning 존재                → PASS_WITH_WARNINGS
  else                                                  → PASS
  ```
- **출력** : `REPORT.md`, `.harness/decision.json`
- **금지 사항** : verdict 의 직접 손편집 경로 없음.

### 3.13 apply — 명시 승인 후 적용

- **명령** : `harness apply --approved`
- **책임** :
  1. `decision.json` 로드 + schema 검증
  2. verdict 검사 (ARCHITECTURE.md §10)
  3. NEEDS_HUMAN_REVIEW 시 `.harness/approval.txt` 토큰 매칭
  4. pre-apply hook 실행
  5. 적용 + `.harness/apply-log.md` 기록
  6. post-review hook 트리거 (선택)
- **금지 사항** : 자동 commit · push · deploy. verdict 우회 플래그 일체 없음.

### 3.14 memory — 학습 적재

- **명령** : `harness apply` 또는 `harness report` 종료 시 자동.
- **책임** : 케이스 누적.
  - false positive
  - false negative
  - missed risk
  - useful rule
  - noisy rule
  - improved prompt
  - changed workflow
- **출력** : `.harness/memory.md`, `.harness/eval-cases/*.json`
- **금지 사항** : 메모리 적재가 verdict 를 사후 변경하지 않음.

## 4. 단계 간 책임 분리 표 (v3)

| 결정 | 책임 단계 | 다른 단계가 대신할 수 있는가 |
|---|---|---|
| "정말 필요한가" 판단 | spec | 불가 |
| "어떻게 쪼갤 것인가" | plan | 불가 |
| "어떤 팀 구조로 일할 것인가" | **harness-design (v3)** | 불가 |
| "어떤 규칙·훅·정책으로 일할 것인가" | **quality-policy (v3)** | 불가 |
| "누가 어떤 task 를 어떻게 handoff 할 것인가" | **team (v3, 의미 축소)** | 불가 |
| "어떻게 구현하는가" | work | 불가 |
| "안전한가" 검증 | gate + codex-review 동시 | 어느 한 쪽도 단독 결정 불가 |
| "적용할 것인가" 최종 판단 | apply | 불가 |
| "어느 도구로 export 할 것인가" | export adapter (gate 무관) | 본 분리 자체가 도구 독립 보장 |

## 5. 단계 건너뛰기 규약

- `harness work --skip-clarify` : intake 의 goal 이 명확하다고 판단 시. spec 단계가 7문항을 다시 강제하므로 우회 효과 제한.
- `harness gate --no-review-adapter` : verdict 상한 `PASS_WITH_WARNINGS`. 자동 PASS 불가. 고위험 변경 시 `codex-missing-risk` 자동 트리거.
- `harness policy --inherit <profile>` : 기존 `.harness/quality-policy.md` 를 재사용 (변경분만 적용).
- `apply` 단계는 어떤 옵션으로도 건너뛸 수 없다.

## 6. 시각화 — 단계 간 데이터 의존

```text
intake.md
   │
   ▼
clarify.md
   │
   ▼
context.md ──────────────┐
   │                     │
   ▼                     │
SPEC.md ─────────────────┤
   │                     │
   ▼                     │
PLAN.md, TASKS.md ───────┤
   │                     │
   ▼                     │
harness-design.md ───────┤
team.json, orchestrator.md, skills-map.json
   │                     │
   ▼                     │
quality-policy.md ───────┤
rules.json, hooks.json, context-policy.md
   │                     │
   ▼                     │
team-runtime.md ─────────┤
agent-routing.json       │
   │                     │
   ▼                     │
worklog.md ──────────────┤
   │                     ▼
self-review.md ◀── codex-review.md, codex-findings.json
   │                     │
   └─────────┬───────────┘
             ▼
        REPORT.md + decision.json
             │
             ▼
        apply-log.md
             │
             ▼
        memory.md, eval-cases/*.json
```

## 7. 실행 예시 (30초 path)

```bash
$ harness init
[ok] .harness/ created.

$ harness ask "사용자 로그인 실패 시 잠금 기능 추가"
[ok] .harness/intake.md saved. clarify questions generated.
[next] harness context

$ harness context
[ok] .harness/context.md saved.
[next] harness spec

$ harness spec
? 누가 쓰는가?            관리자 콘솔 사용자
? 왜 필요한가?            연속 실패 시 무차별 대입 방어
? ... (7문항)
[ok] .harness/SPEC.md saved.

$ harness plan
[ok] .harness/PLAN.md, .harness/TASKS.md saved.
[next] harness design

$ harness design
[info] domain: backend auth. recommended pattern: Producer-Reviewer.
[ok] .harness/harness-design.md, team.json, orchestrator.md, skills-map.json saved.

$ harness policy
[info] applying ts-strict rules + auth-security hooks.
[ok] .harness/quality-policy.md, rules.json, hooks.json, context-policy.md saved.

$ harness team
[ok] .harness/team-runtime.md, agent-routing.json saved.

$ harness work TASK-001
... (사용자 또는 agent 가 코드 변경)
[ok] worklog updated.

$ harness review
[ok] self-review.md, codex-review.md, codex-findings.json saved.

$ harness gate
[verdict] PASS_WITH_WARNINGS
[next] review REPORT.md → harness apply --approved

$ harness apply --approved
[ok] applied. .harness/apply-log.md updated.

$ harness export claude
[ok] .claude/agents/*.md, .claude/skills/*.md, CLAUDE.md 포인터 생성.
```

## 8. 본 문서가 답하지 않는 것

- 각 단계가 "왜 분리되어야 하는가" → PRODUCT.md §3, §7
- 단계 구현체의 모듈 구조 → ARCHITECTURE.md §3, §4
- 팀 패턴 6종의 상세 선택 기준 → HARNESS-DESIGN.md
- rules/hooks/context-policy 의 묶음 정책 → QUALITY-POLICY.md
- 어떤 위험을 어떻게 차단하는가 → SECURITY.md
- CLI 인자/플래그/exit code → CLI.md
- 구현 task 분해 → TASKS.md
