# NEKOFORGE

> AI 가 만든 코드를 그냥 머지하기 전에, 검증·차단·승인 단계를 **CLI 로 강제**하는 local-first 개발 공정 도구.

**한 문장 요약**

```text
AI 가 코드를 만든다 → 본 도구가 14단계로 검증 + 차단 + Human Gate → 통과 시에만 적용.
```

**누구를 위한 도구인가**

- AI(Claude Code · Codex · Cursor 등)로 코드를 만드는 **혼자 작업하는 시니어** 또는 **소규모 팀 리드**.
- "AI 가 만든 코드 / 테스트 통과했길래 머지 → 사고" 경험이 있는 사람.
- 외부 SaaS 없이 **로컬에서만** 동작하는 검증 공정이 필요한 사람.

**핵심 가치**

- ❶ verdict 가 `BLOCK` / `INSUFFICIENT_EVIDENCE` 면 어떤 플래그로도 apply 되지 않는다.
- ❷ secret 하드코딩 · auth 우회 · 테스트 삭제 같은 위험 패턴 9종을 deterministic rule 로 즉시 차단.
- ❸ 모든 의사결정은 `.md` (사람용) + `.json` (기계용) 으로 동시에 남는다.
- ❹ Codex/Claude 같은 외부 어댑터는 검증자이지 **최종 승인자가 아니다**. 사람 토큰 매칭이 필수.

---

## 30초 사용 흐름

```bash
$ harness init                            # .harness/ 워크스페이스 만들기
$ harness ask "사용자 로그인 잠금 기능 추가"   # 목표 저장 + clarify 질문
$ harness context                         # 도메인·구조·제약 정리 (사용자가 채움)
$ harness spec                            # 7문항 강제 답변 → SPEC.md
$ harness plan                            # 작은 task + 테스트 계획
$ harness design --pattern Producer-Reviewer   # 팀 패턴 선택
$ harness policy                          # rules·hooks·context-policy 묶음
$ harness team                            # 실행 routing

# (여기서 IDE/AI 로 실제 코드 변경 작성)

$ harness work TASK-001                   # diff 캡처 + pending patch 격리
$ harness review --adapter codex          # self-review + 외부 어댑터
$ harness gate                            # verdict 산출 → REPORT.md + decision.json
$ harness apply --approved                # verdict + Human Gate 통과 시에만 적용
$ harness export claude                   # (선택) .claude/agents 로 export
```

---

## 무엇이 차단되는가

이 도구가 자동으로 잡는 9가지 위험 패턴(deterministic rules) :

| Rule | 잡는 것 | 어떤 verdict |
|---|---|---|
| `secret-fallback` | `process.env.X \|\| "fallback-key"` 같은 하드코딩 fallback | BLOCK |
| `auth-bypass` | `requireAuth()` 제거, `if (true)` bypass, `NODE_ENV !== production` 우회 | BLOCK |
| `test-deletion` | 테스트 파일 삭제 또는 `.skip(` `@Disabled` `t.Skip(` 추가 | BLOCK / NEEDS_HUMAN_REVIEW |
| `no-test-risk` | src 변경 있는데 tests 변경 없음 | PASS_WITH_WARNINGS |
| `dangerous-file-write` | `.env`, CI 워크플로, `auth/`, `Dockerfile`, k8s, Terraform | NEEDS_HUMAN_REVIEW |
| `hook-injection-risk` | `package.json` postinstall, `.husky/`, `.harness/hooks.json` 의 화이트리스트 외 명령 | NEEDS_HUMAN_REVIEW |
| `agent-permission-risk` | 한 agent 가 impl + security 같은 핵심 역할 겸직 | NEEDS_HUMAN_REVIEW |
| `auto-apply-block` | BLOCK / INSUFFICIENT_EVIDENCE 상태에서 apply 시도 | apply 진입 차단 (exit 4) |
| `codex-missing-risk` | 고위험 변경 + 외부 review 부재 | NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE |
| (메타) `audit-integrity` | `.harness/audit.jsonl` chain hash / anchor 위변조 | NEEDS_HUMAN_REVIEW |

TypeScript/JavaScript 외에 **Python, Go** 휴리스틱도 포함.

---

## 어떻게 동작하는가

**14단계 공정**을 순서대로 강제. 각 단계는 다른 명령으로만 진행되고, 모두 파일로 증거를 남긴다.

```text
intake → clarify → context → spec → plan
       → harness-design → quality-policy → team
       → work → self-review → codex-review
       → gate → apply → memory
```

**core 가 14개 모듈** (`src/core/<stage>/`) 로 1:1 분리, **`dependency-cruiser` 가 단계 간 직접 호출을 금지**(통신은 항상 `.harness/` artifact 파일을 통해서만). 이 구조가 "단계 한 개가 다른 단계를 대신할 수 없다" 는 본 도구의 핵심 약속을 강제한다.

**Verdict 5종**

```text
PASS              → apply 허용
PASS_WITH_WARNINGS → apply 허용 (warning 발화)
NEEDS_HUMAN_REVIEW → .harness/approval.txt 토큰 매칭 시에만 apply
BLOCK             → apply 거부 (exit 4)
INSUFFICIENT_EVIDENCE → apply 거부 (exit 4) — evidence/schema 위반
```

---

## 왜 이렇게 만들었는가

기존 도구들의 빈틈을 **역할별로 분리해서** 채운다. 단일 제품이 모든 것을 다 하려고 하지 않는다.

| 참고 프로젝트 | NEKOFORGE 에서의 역할 | 단계 위치 |
|---|---|---|
| **Gstack** | 제품 질문 / 스펙 압축 | clarify · spec |
| **Superpowers** | spec-first · plan-first · TDD discipline | spec · plan · work |
| **Everything Claude Code (ECC)** | rules · hooks · context · security 카탈로그 | quality-policy |
| **revfactory/harness** | 도메인 → 팀 아키텍처 설계 | harness-design |
| **OMC** | 멀티 에이전트 실행 routing | team · work |
| **Codex** | 외부 독립 코드 검증 | codex-review |
| **[NEKOWORK](https://github.com/Ps-Neko/NEKOWORK)** | verdict · decision.json · Human Gate · explicit apply | gate · apply |

NEKOWORK 가 좁고 깊은 **검증 게이트** 라면, NEKOFORGE 는 그 사상을 1개 단계(gate/apply)로 흡수해 **14단계 통합 공정으로 확장한 가족 도구** 다.

---

## `.harness/` core · `.claude/` 는 export

```text
.harness/team.json       ──▶ harness export claude  ──▶ .claude/agents/*.md
.harness/skills-map.json ──▶ harness export cursor  ──▶ .cursor/rules/*.md
.harness/quality-policy.md ─▶ harness export codex  ──▶ .codex/agents/*.md
                          ──▶ harness export generic ─▶ .export/*.* + manifest.json
```

- `.harness/` 가 **유일한 사실원**(Single Source of Truth).
- `.claude/`, `.cursor/`, `.codex/` 는 모두 **결정적 단방향 export** 결과물. 본 도구는 이들을 절대 **읽지 않는다**.
- AI 도구가 자주 바뀌어도 검증 공정은 `.harness/` 하나로 유지.

---

## 절대 하지 않는 것

- ❌ 자동 git commit · push · deploy
- ❌ `BLOCK` / `INSUFFICIENT_EVIDENCE` 상태에서 apply (어떤 플래그로도)
- ❌ 단일 외부 어댑터(Codex 등)의 PASS 만으로 자동 승인
- ❌ `decision.json` 위변조에 의한 PASS 위장 (cross-field 일관성 검증)
- ❌ agent 권한 겸직 (`implementation-agent` + `security-reviewer` 동일 ID)
- ❌ `harness export` 의 역방향 import (`.claude/` → `.harness/`)

---

## 문서

| 문서 | 답하는 질문 |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | 무엇을 위한 도구인가, 무엇이 아닌가 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 어떻게 구성되어 있는가 |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | 단계별로 무엇이 어떤 순서로 일어나는가 |
| [docs/HARNESS-DESIGN.md](docs/HARNESS-DESIGN.md) | 팀 패턴 6종 중 언제 어떤 것을 쓰는가 |
| [docs/QUALITY-POLICY.md](docs/QUALITY-POLICY.md) | rules/hooks/context-policy 묶음 |
| [docs/SECURITY.md](docs/SECURITY.md) | 위협 모델과 차단 메커니즘 |
| [docs/CLI.md](docs/CLI.md) | 명령 인자·exit code·도움말 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 와 마일스톤 |
| [TASKS.md](TASKS.md) | 구현 task 분해 |
| [examples/](examples/) | 6개 시나리오 (basic-flow · blocked-by-secret · needs-human-review · codex-missing · export-claude · self-host 3회차) |

---

## 현재 상태

- **Phase A~E 완료** + Phase C/D 후속 + Codex feedback rounds (self-host **#3, #4**).
- `npm test` : **200/200 통과**.
- ROADMAP §9 마일스톤 M0~M8 모두 도달.
- 외부 검증 **2건 누적** (Codex 2026-05-19) — examples/phase-codex-feedback/, phase-codex-rereview/ 참고.
- Phase F (협업 모델) 만 보류 (외부 수요 조건부).

설치·실행은 TypeScript 5 + Node.js 20 LTS 기반 :

```bash
git clone https://github.com/Ps-Neko/NEKOFORGE.git
cd NEKOFORGE
npm install
npm test            # 194/194 통과 확인
npx tsx src/cli/index.ts --help   # CLI 확인
```

---

## 책임 경계

NEKOFORGE 는 **14단계 산출물의 골격(구조)과 단계 간 강제력(차단)** 만 책임진다. 산출물의 **내용**(context 본문, plan task 의 실제 텍스트, self-review 의 점검 항목 등)은 사용자/agent 가 채운다. 자세히는 [docs/SECURITY.md §0](docs/SECURITY.md).

---

## 정체성 한 줄

```text
"제품 질문 → 도메인 정리 → 스펙 → 개발 계획 →
 팀 아키텍처 설계 → 품질 정책 → 팀 실행 →
 작은 task 단위 구현 → self-review → Codex 독립 검증 →
 deterministic gate → Human Gate → explicit apply"
를 강제하는 local-first AI Development Harness.
```

이 한 줄과 충돌하는 모든 추가 기능 제안은 우선 거부된다.
