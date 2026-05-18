# PRODUCT — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 v3 사양 기준 제품 정체성, 사용자, 가치, 비목표를 못박는 1차 명세다. 모든 다른 문서(ARCHITECTURE, WORKFLOW, HARNESS-DESIGN, QUALITY-POLICY, SECURITY, ROADMAP, CLI, TASKS)는 이 문서를 상위 근거로 삼는다.

## 1. 한 줄 정의

Verified AI Development Harness 는 "AI 가 코드를 만들 수는 있어도, AI 가 만든 변경은 **독립 검증과 사람 승인 없이 적용될 수 없다**" 는 원칙을, 7개 축의 역할 분리를 통해 강제하는 **Local-first CLI 개발 공정 하네스**다.

## 2. 제품 정체성

```text
agent pack 이 아니다.
prompt pack 이 아니다.
skill catalog 가 아니다.
Claude Code 설정 모음이 아니다.
review-only 도구도 아니다.

"제품 질문 → 도메인 정리 → 스펙 → 개발 계획 →
 팀 아키텍처 설계 → 품질 정책 → 팀 실행 →
 작은 task 단위 구현 → self-review → Codex 독립 검증 →
 deterministic gate → Human Gate → explicit apply" 를 강제하는
Local-first AI Development Harness."
```

정체성은 다음 결정에서 드러난다.

- 내부 표준은 `.harness/` 다. `.claude/`, `.cursor/`, `.codex/` 등은 모두 **export adapter** 다.
- agent 수가 아니라 **단계 통과 여부**가 진행률이다.
- 첫 화면이 "agent 목록" 이 아니라 **현재 어떤 단계에 있는가**다.
- 모든 결정은 사람이 읽는 `.md` + 기계가 읽는 `.json` 으로 동시에 남는다.
- 어떤 외부 도구(Claude Code, Codex, Cursor, Gemini) 의 부재로도 핵심 게이트가 멈추지 않는다.

## 3. 제품 원칙 3문장

1. AI 는 코드를 만들 수 있지만, AI 가 만든 변경은 독립 검증 없이 적용되지 않는다.
2. 제품 질문 · 개발 계획 · **팀 설계** · **품질 정책** · **팀 실행** · 구현 · 검증 · 출고 판단은 **각자 다른 단계**이며, 한 단계가 다른 단계를 대신할 수 없다.
3. 위험 작업은 **명시적 사람 승인** 없이는 apply · commit · push · deploy 되지 않는다.

이 세 문장이 충돌하는 모든 결정은 이 세 문장 쪽으로 정렬한다.

## 4. 7개 축의 역할 분리

본 제품의 가장 큰 사상은 "참고 프로젝트들을 합치지 않고, 역할별로 쪼개어 직렬화" 한다는 것이다.

| 참고 | 흡수한 역할 | 단계 위치 | 비유 |
|---|---|---|---|
| **Gstack** | 제품 질문 / 스펙 압축 | clarify · spec | 기획실 |
| **Superpowers** | spec-first · plan-first · TDD · 작은 task | spec · plan · work | 개발 공정 표준서 |
| **Everything Claude Code (ECC)** | rules · hooks · context · security 카탈로그 | quality-policy | 작업 매뉴얼 창고 + 자동 안전 센서 |
| **revfactory/harness** | 도메인 기반 팀 아키텍처 설계 (Pipeline · Fan-out/Fan-in · Expert Pool · Producer-Reviewer · Supervisor · Hierarchical Delegation) | harness-design | 공장 설계 사무소 |
| **OMC** | 멀티 에이전트 실행 · routing · handoff | team · work | 작업반 운영실 |
| **Codex** | 외부 독립 코드 검증자 | codex-review | 외부 품질감사관 |
| **NEKOWORK식 Verified Gate** | verdict · decision.json · REPORT.md · Human Gate · explicit apply | gate · apply | 출고 승인 게이트 |

**v3 핵심 통찰**: revfactory/harness 와 OMC 는 비슷해 보이지만 다르다.

```text
revfactory/harness = "어떤 팀 구조로 일할 것인가" (설계)
OMC                = "그 팀을 어떻게 운용할 것인가" (실행)
```

이 둘을 한 단계에 묶지 않고 분리한 것이 v3 의 가장 큰 결정이다.

## 5. 누가 쓰는가

### 5.1 1차 사용자 — "혼자 코드 짜는 시니어 개인 개발자"

- AI(Claude Code, Codex, Cursor, Gemini, Copilot)를 일상적으로 사용.
- 생산성은 올랐지만 "AI 가 만든 코드를 검토 없이 머지하다 사고난 경험" 누적.
- 외부 리뷰어가 없거나 한 사람뿐이라 cross-check 부족.
- 자기 자신을 cross-check 하기 위해 도구가 필요.

### 5.2 2차 사용자 — "소규모 팀 리드"

- 2~5명짜리 팀에서 PR review 가 형식적이 되어가는 것을 우려.
- 모든 PR 에 동일한 출고 게이트를 강제하고 싶음.
- SaaS 도입 없이 로컬에서 동작해야 함(소스가 사외로 나가면 안 됨).

### 5.3 3차 사용자 (v3 신규) — "여러 AI 도구를 병행하는 개인/팀"

- Claude Code + Codex + Cursor 를 동시 사용.
- 각 도구마다 자기 표준(`.claude/`, `.codex/`, `.cursor/`)을 강요하는 것이 불편.
- "도구는 바뀌어도 내 검증 공정은 그대로" 인 환경을 원함.
- `.harness/` 가 1급, 도구별 디렉터리는 export 인 v3 구조가 이 사용자를 위한 것.

### 5.4 명시적 비사용자

- "AI 에게 전부 맡기고 자고 일어나면 배포되어 있길 바라는 사용자" — 이 제품의 목적과 정반대.
- "100개 agent 카탈로그가 필요한 사용자" — 다른 제품을 사용하라.
- "코드 자동 생성기만 필요한 사용자" — 이 제품의 강점은 자동 생성이 아니라 자동 검증·차단이다.
- "Claude Code 외 다른 도구는 절대 안 쓰는 사용자" — 본 제품은 동작하지만, `.claude/` 직접 사용 도구가 더 효율적일 수 있음.

## 6. 왜 필요한가 — 문제 진술

### 6.1 시장의 공백 (v3 갱신)

| 영역 | 현재 상태 | 공백 |
|---|---|---|
| Agent orchestration (OMC) | 다수 agent 협업·역할 분배 가능 | 협업 결과를 **출고해도 되는가** 판단은 사람 몫 |
| 제품 질문 (Gstack) | "정말 필요한가" 질문 강제 가능 | 질문 이후 코드 변경의 검증 단계는 별도 |
| 개발 discipline (Superpowers) | spec-first · plan-first · TDD 강제 | 강제는 가이드 수준, **차단 메커니즘** 부재 |
| 품질 카탈로그 (ECC) | rules · hooks · skills · security 풍부 | 어떤 조합을 언제 적용할지의 **정책 설계** 단계 부재 |
| 팀 설계 (revfactory/harness) | 도메인 → 팀 구조 자동 설계 | 설계 결과가 **검증 게이트** 와 연결되지 않음 |
| 독립 코드 검증 (Codex) | diff 단위 리뷰 가능 | 리뷰 결과가 **자동 승인자**가 되면 검증 의미 상실 |
| Verified Gate (NEKOWORK식) | evidence · decision.json · Human Gate | 상류(질문·계획·설계·정책) discipline 까지는 못 잡음 |

각 영역의 통과가 다른 영역의 통과로 오인되는 사고가 반복된다.

### 6.2 핵심 통증 시나리오 (v3 갱신)

> "Claude/Codex 에 시켜 코드를 만들었다. 테스트도 통과했다. 그래서 머지했다. 그런데 어제 누가 만든 fallback secret 이 그대로 들어가 있었다."

> "팀 설계 도구로 agent 5개를 깔끔하게 만들어 놨다. 그런데 실행 단계에서 agent 가 서로 'OK' 라고 한 것을 사람이 OK 로 오인했다 — 검증자가 없었다."

> "Claude Code 만 쓰다가 Codex 도 같이 쓰게 되니, `.claude/` 와 `.codex/` 가 따로 놀았다. 어디가 진실원인지 알 수 없게 됐다."

> "ECC 의 hook 100개를 다 깔아놨더니 컨텍스트가 폭발하고, 정작 어느 hook 이 어느 결정에 영향을 줬는지 추적 불가."

이 제품은 이 네 시나리오를 막기 위해 존재한다.

## 7. 핵심 가치 약속 (Product Promise)

1. **단계 분리 보장** — 제품 질문/계획/팀 설계/품질 정책/구현/검증/출고는 서로 다른 명령으로만 진행. 한 명령이 두 단계를 동시에 끝내지 못한다.
2. **차단 보장** — verdict 가 `BLOCK` 또는 `INSUFFICIENT_EVIDENCE` 인 경우 `harness apply` 는 어떤 플래그로도 통과하지 못한다.
3. **증거 보장** — 모든 의사결정은 `.harness/` 하위에 사람이 읽는 `.md` 와 기계가 읽는 `.json` 으로 동시에 남는다.
4. **독립성 보장** — Codex(또는 다른 외부 리뷰 어댑터)는 **검증자**일 뿐 최종 승인자가 아니다.
5. **로컬 우선 보장** — 모든 기본 동작은 외부 SaaS · 원격 서버 없이 로컬에서 수행한다.
6. **도구 독립 보장 (v3 신규)** — `.harness/` 가 core. Claude Code, Codex, Cursor 등의 디렉터리는 `harness export` 로 생성되는 adapter 출력일 뿐, 의존성이 아니다.
7. **설계·실행 분리 보장 (v3 신규)** — "어떤 팀으로 일할지" (harness-design) 와 "그 팀을 어떻게 운용할지" (team) 는 다른 단계다. 설계 변경이 즉시 실행 변경으로 새지 않는다.

## 8. 핵심 기능 (MVP)

- `harness init` : `.harness/` 디렉터리와 기본 설정 부트스트랩
- `harness ask "<goal>"` : 사용자 원문 요청 저장 + clarify 질문 트리거
- `harness context` : 도메인·기존 구조·제약 정리
- `harness spec` : Gstack식 7문항(±) 강제 답변, `SPEC.md` 생성
- `harness plan` : Superpowers식 작은 단위 task, `PLAN.md`/`TASKS.md` 생성
- `harness design` : revfactory식 팀 아키텍처 설계, `harness-design.md`/`team.json`/`orchestrator.md`/`skills-map.json` 생성
- `harness policy` : ECC식 품질 정책, `quality-policy.md`/`rules.json`/`hooks.json`/`context-policy.md` 생성
- `harness team` : OMC식 실행 routing, `team-runtime.md`/`agent-routing.json` 생성
- `harness work <task-id>` : 1개 task 단위 구현 로그
- `harness review` : self-review + Codex review 어댑터 호출
- `harness gate` : verdict 산출, `REPORT.md`/`decision.json` 생성
- `harness apply --approved` : verdict + 사람 승인 모두 충족 시에만 변경 적용
- `harness report` : 현재 단계와 verdict 상태 사람 친화 출력
- `harness export claude` : `.harness/` 표준을 Claude Code 형식으로 export (adapter)

## 9. 명시적 비목표 (이번 버전에서 하지 않을 것)

- 자동 git commit / push / deploy
- agent marketplace · agent 100개 카탈로그
- 원격 SaaS 대시보드
- 모든 언어·프레임워크 지원 (MVP 는 TypeScript/Node.js 프로젝트 대상)
- IDE 플러그인
- 다중 사용자 협업 권한 모델
- LLM 호출 비용 최적화 자체 기능
- 자체 LLM 호스팅
- ECC 전체 카탈로그 복제
- Claude Code 또는 특정 단일 도구에 종속된 core 구조

위 항목 중 일부는 ROADMAP 단계에서 다시 평가하되, MVP 평가 기준에는 들어가지 않는다.

## 10. 성공 기준

다음 7개가 모두 만족해야 MVP 가 "성공" 으로 평가된다.

1. **단계 강제** — 사용자가 `harness work` 호출 시 SPEC·PLAN·TASKS·harness-design·quality-policy·team 중 하나라도 누락이면 작업이 거부된다.
2. **차단 강제** — `decision.json.verdict ∈ {BLOCK, INSUFFICIENT_EVIDENCE}` 상태에서 `harness apply --approved` 가 변경을 적용하면 안 된다. 테스트로 증명.
3. **증거 강제** — `harness gate` 실행 후 `REPORT.md` 와 `.harness/decision.json` 이 동시에 존재하고 schema 검증 통과.
4. **deterministic rule 동작** — 9개 룰(secret-fallback, auth-bypass, test-deletion, no-test-risk, dangerous-file-write, hook-injection-risk, agent-permission-risk, auto-apply-block, codex-missing-risk)이 모두 실제 변경 케이스에 대해 탐지 가능.
5. **30초 path** — 신규 사용자가 README 만 보고 30초 안에 `harness init` → `harness ask` → 첫 산출물 확인까지 도달.
6. **도구 독립** — Codex 없이도 deterministic gate 가 동작. `.harness/` 표준이 단독으로 의미를 가짐.
7. **export adapter** — `harness export claude` 가 `.harness/team.json` 으로부터 `.claude/agents/*.md` 를 결정적으로 생성. 역방향(`.claude/` → `.harness/`)은 MVP 비범위.

## 11. 비-성공 시나리오 (이런 상태면 실패)

- agent 가 11개 role 정의를 넘어 그 이상으로 확장.
- CLI 명령어가 18개를 넘는다.
- `harness apply` 가 verdict 확인을 우회할 수 있는 경로가 한 개라도 존재.
- `decision.json` 이 일부 단계에서만 생성.
- 외부 SaaS 키 없이는 동작하지 않는 핵심 기능이 한 개라도 존재.
- README 의 "30초 path" 가 실제로 5분 걸린다.
- `.harness/` 없이 `.claude/` 만으로 작동하는 우회 경로 존재.
- `harness-design` 의 팀 패턴 선택이 `team` 단계 결과에 반영되지 않음(설계·실행 분리 실패).

## 12. 용어 정의

| 용어 | 의미 |
|---|---|
| harness | 본 CLI 도구 이름이자, 본 도구가 생성하는 `.harness/` 디렉터리 단위의 작업 공간 |
| stage / 단계 | intake · clarify · context · spec · plan · harness-design · quality-policy · team · work · self-review · codex-review · gate · apply · memory 14개 단계 |
| artifact | 각 단계가 남기는 산출물 파일 (`.md` 또는 `.json`) |
| verdict | gate 단계가 계산하는 최종 판정 (`PASS` / `PASS_WITH_WARNINGS` / `NEEDS_HUMAN_REVIEW` / `BLOCK` / `INSUFFICIENT_EVIDENCE`) |
| team pattern | revfactory/harness 식 6종 (Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical Delegation) |
| quality policy | rules + hooks + context-policy + security checklist 의 묶음 |
| deterministic rule | 코드 변경에 대해 LLM 없이도 결정 가능한 차단/경고 규칙 (9종) |
| Human Gate | verdict 가 자동 PASS 가 아닐 때, 사람 명시 승인 없이는 apply 가 금지되는 메커니즘 |
| apply | 검토된 변경을 실제 워킹 트리/대상 파일에 반영하는 행위 (commit · push · deploy 와는 별개) |
| adapter / export | `.harness/` 표준을 외부 도구 형식(Claude Code 의 `.claude/`, Cursor 의 `.cursor/` 등)으로 변환하는 단방향 모듈 |

## 13. 본 문서가 답하지 않는 것

- "어떻게 구현하는가" → ARCHITECTURE.md
- "어떤 순서로 단계가 흐르는가" → WORKFLOW.md
- "팀 패턴은 언제 어떤 것을 쓰는가" → HARNESS-DESIGN.md
- "어떤 rules/hooks/context 를 어떻게 묶는가" → QUALITY-POLICY.md
- "어떤 위험을 어떻게 차단하는가" → SECURITY.md
- "언제까지 무엇을 만드는가" → ROADMAP.md
- "CLI 인자와 출력 형식" → CLI.md
- "구현 task 분해" → TASKS.md
