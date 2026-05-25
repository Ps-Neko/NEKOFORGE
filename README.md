# NEKOFORGE

[![CI](https://github.com/Ps-Neko/NEKOFORGE/actions/workflows/test.yml/badge.svg)](https://github.com/Ps-Neko/NEKOFORGE/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-0.5.0--alpha.0-blue.svg)](RELEASE-NOTES.md)

> **Quality Contract 기반 Local-first AI Development Factory**.
> AI 가 만든 산출물을 품질 계약 기준으로 검사하고, 점수화하고, 위험하면 막고, 사람 승인 전에는 apply 하지 못하게 한다.

> NEKOFORGE 는 OMC 처럼 일을 시키는 도구가 아니고, ECC 처럼 스킬을 많이 쌓는 도구도 아니다. 그 도구들이 만든 산출물을 **품질 계약 기준으로 검증하고 출고를 통제하는 공장** 이다.

**현재 상태**: `v0.5.0-alpha` · 14단계 + 26 CLI (init/doctor 포함) · Worker Factory (8 worker role + 3 profile) · Rule Pack 13종 + Skill Pack 13종 · benchmark = 30 local fixtures (sample recall 1.000, FP 0.000) · self-host 11회 통과 · external Codex review 3회 + self-review 1회 통합.

**Beta 진입 조건** ([ROADMAP §10](docs/ROADMAP.md#10-외부-검증-기준-beta--10-진입-조건)): ✅ FP fixture 5개 · ✅ 모든 rule eval-case 적재 · ⏳ **외부 사용자 1명 이상이 본인 PR 에 NEKOFORGE 를 실행해 REPORT.md + decision.json + quality-score.json 을 제출**.

**빠른 시작**: [GETTING-STARTED.md](GETTING-STARTED.md) · [examples/00-first-verdict](examples/00-first-verdict/) — 10분 안에 첫 verdict.
**기여 가이드**: [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/ALPHA-RECRUITMENT.md](docs/ALPHA-RECRUITMENT.md) · [docs/EXTERNAL-VALIDATION-TEMPLATE.md](docs/EXTERNAL-VALIDATION-TEMPLATE.md) — 외부 사용자 PR 환영.

**한 문장 요약**

```text
NEKOFORGE 는 AI 작업자와 Rule/Skill Pack 을 통제하고,
Quality Contract 와 Worker Evidence 를 기준으로 산출물을 점수화하며,
deterministic gate 와 Human Gate 없이는 출고하지 않는
local-first AI Development Factory 다.
```

흐름:

```text
AI 작업자 배치 → Rule/Skill Pack 적용 → Quality Contract →
Worker Evidence → Quality Score + deterministic verdict →
Human Gate → explicit apply.
```

> **Worker Factory is controlled evidence orchestration, not unattended execution.**
> 자동 LLM 실행기가 아니라, 작업자 지시서 생성 + 결과 증거 회수 + gate 입력 계층.

**누구를 위한 도구인가**

- AI(Claude Code · Codex · Cursor 등)로 코드를 만드는 **혼자 작업하는 시니어** 또는 **소규모 팀 리드**.
- "AI 가 만든 코드 / 테스트 통과했길래 머지 → 사고" 경험이 있는 사람.
- 외부 SaaS 없이 **로컬에서만** 동작하는 검증 공정이 필요한 사람.

**핵심 가치 (6)**

- ❶ **Quality Contract before Work** — `quality-contract.json` 없으면 `work` 진입 거부.
- ❷ **Quality Score before PASS** — 8 영역 점수 미달이면 `PASS` 불가, 상한 자동 강등.
- ❸ verdict `BLOCK` / `INSUFFICIENT_EVIDENCE` 는 **어떤 플래그로도** apply 안 됨.
- ❹ secret 하드코딩 · auth 우회 · 테스트 삭제 · input validation 누락 등 **35 deterministic rule (9 security + 4 architecture + 3 design + 4 api-safety + 4 dependency + 3 docs + 4 release-evidence + 4 frontend)** 을 즉시 차단 (다수는 info 등급 알림).
- ❺ 모든 의사결정은 `.md` + `.json` 으로 동시에 남고, audit chain hash + anchor 로 위변조 감지.
- ❻ Codex/Claude/Cursor 어댑터는 검증자이지 **최종 승인자가 아니다**. 사람 토큰 매칭 필수.

---

## A. 10-minute first verdict (외부 사용자 빠른 시작)

본 도구가 처음이면 preset + self-host 한 줄:

```bash
$ npm install
$ npm run build
$ node dist/src/cli/index.js doctor                                # 환경 진단
$ node dist/src/cli/index.js init --preset cli-tool                # 본인 프로젝트 타입 시드
$ node dist/src/cli/index.js self-host --goal "first verdict smoke"
```

전역 alias (`nekoforge` / `harness`) 사용 시 `npm link` 후:

```bash
$ nekoforge doctor
$ nekoforge init --preset cli-tool
$ nekoforge self-host --goal "first verdict smoke"
```

본 흐름이 막히면 [examples/00-first-verdict/](examples/00-first-verdict/) 의 단계별 가이드 참조.

## B. Full factory path (실제 14단계 + Worker Factory)

```bash
$ nekoforge init --preset backend-api
$ nekoforge ask "<목표 한 줄>"
$ nekoforge context
$ nekoforge spec
$ nekoforge plan
$ nekoforge workers init --profile standard      # init --preset 했으면 생략 가능
$ nekoforge rule-pack audit                      # template 별 required pack 확인
$ nekoforge skill-pack audit                     # template 별 recommended pack 확인
$ nekoforge dispatch TASK-001 --all              # 전체 worker prompt 생성
# (사용자가 각 worker prompt 를 LLM 에 입력해 result.md 작성)
$ nekoforge worker-result import TASK-001 --worker implementation-worker --file impl.md
# ... 다른 worker 들도 import
$ nekoforge worker-result validate TASK-001
$ nekoforge review
$ nekoforge gate                                  # → verdict
$ nekoforge apply --approved                      # PASS/PASS_WITH_WARNINGS 시
```

local checkout (npm link 없이) 에서는 `nekoforge` 대신 `node dist/src/cli/index.js` 또는 `npm run dev --` 사용.

## 30초 명령 시퀀스 (참고용 — 실제 작성 시간 별도)

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
$ harness gate --strict                   # (CI) clean PASS 아니면 non-zero exit
$ harness apply --approved                # verdict + Human Gate 통과 시에만 적용
$ harness export claude                   # (선택) .claude/agents 로 export
```

---

## 무엇이 차단되는가

이 도구가 자동으로 잡는 **35 deterministic rule** (9 security + 4 architecture + 3 design + 4 api-safety + 4 dependency + 3 docs + 4 release-evidence + 4 frontend) — 주요 9종:

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

### 핵심 (모든 사용자)

| 문서 | 답하는 질문 |
|---|---|
| [GETTING-STARTED.md](GETTING-STARTED.md) | 10분 안에 첫 verdict |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 외부 사용자 PR 절차 + 정체성 보호 |
| [docs/PRODUCT.md](docs/PRODUCT.md) | 무엇을 위한 도구인가, 무엇이 아닌가 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 어떻게 구성되어 있는가 |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | 단계별로 무엇이 어떤 순서로 일어나는가 |
| [docs/CLI.md](docs/CLI.md) | 명령 인자·exit code·도움말 (25 명령) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 와 마일스톤 |
| [TASKS.md](TASKS.md) | 구현 task 분해 |

### 영역별 (필요 시)

| 문서 | 답하는 질문 |
|---|---|
| [docs/HARNESS-DESIGN.md](docs/HARNESS-DESIGN.md) | 팀 패턴 6종 중 언제 어떤 것을 쓰는가 |
| [docs/QUALITY-POLICY.md](docs/QUALITY-POLICY.md) | rules/hooks/context-policy 묶음 |
| [docs/SECURITY.md](docs/SECURITY.md) | 위협 모델과 차단 메커니즘 |
| [docs/QUALITY-CONTRACT.md](docs/QUALITY-CONTRACT.md) | 5 template 의 quality bars + productIntent (Phase QF) |
| [docs/QUALITY-SCORE.md](docs/QUALITY-SCORE.md) | 8 영역 정량 점수 (Phase QF) |
| [docs/FACTORY-CELLS.md](docs/FACTORY-CELLS.md) | product/architecture/build/quality/review/gate 상태 (Phase QF) |
| [docs/BENCHMARKS.md](docs/BENCHMARKS.md) | fixture 운영 + critical recall / FP rate (Phase QF) |
| [docs/INTEGRATIONS-OMC-ECC-HERMES.md](docs/INTEGRATIONS-OMC-ECC-HERMES.md) | 대체 아니라 병행 (Phase QF) |
| [docs/WORKER-FACTORY.md](docs/WORKER-FACTORY.md) | 8 worker role + 3 profile + role separation (Phase WF) |
| [docs/WORKER-SAFETY.md](docs/WORKER-SAFETY.md) | worker 가 할 수 없는 것 + forbidden action (Phase WF) |
| [docs/RULE-PACKS.md](docs/RULE-PACKS.md) | 8 rule pack + template 자동 추천 (Phase RP) |
| [docs/SKILL-PACKS.md](docs/SKILL-PACKS.md) | 7 skill pack + worker prompt 흡수 (Phase RP) |
| [examples/](examples/) | 10 시나리오 + 10 phase 흔적 ([index](examples/README.md)) |

---

## 현재 상태

- **Phase A~E + QF + WF/RP + UX/WF-2/RP-2/DX/EV/QA 완료** + Codex feedback rounds (self-host **#3, #4, #5**) + QF self-audit ×2 (#6, #7) + Windows hook fix (#6) + self-host #8~#11 (stub mode / 정합 / fixture 확장).
- `npm test` : 전체 테스트 통과 확인 — `npm run verify` 통과.
- `npm run benchmark` : **local fixtures sample recall 1.000 / FP rate 0.000** (실 외부 벤치마크 아님).
- `depcruise` : **0 violations**.
- GitHub Actions CI 활성 (typecheck + lint + depcheck + build + test + benchmark 자동).
- ROADMAP §9 마일스톤 M0~M8 모두 도달.
- 외부 검증 **3건 누적** (Codex 2026-05-18~19) + v0.5 검증 요청 발송 (`.review-requests/codex-review-v0.5.md`).
- Phase F (협업 모델) 만 보류 (외부 수요 조건부).

### Phase WF/RP 추가 산출 (v0.5)

- 8 worker role + 3 profile (`harness workers init/list/status/validate`).
- `harness dispatch <task> --worker <role>` — prompt 생성 + worker-result import.
- 8 rule pack (`harness rule-pack <list/enable/disable/status/audit>`).
- 7 skill pack (`harness skill-pack <…>`).
- `decision.json` v0.4 → v0.5 (`workerFactory` / `rulePacks` / `skillPacks` 3 필드 신규).
- `docs/WORKER-FACTORY.md`, `WORKER-SAFETY.md`, `RULE-PACKS.md`, `SKILL-PACKS.md` 신규.
- T-WF 5건 + T-RP 4건 e2e + 단위 18건 추가.

### Phase QF 추가 산출 (v0.4)

- `harness contract --template <web-ui|cli-tool|backend-api|library|custom>` — Quality Contract 강제
- `harness benchmark [--group <name>]` — fixture 기반 critical recall / FP rate 측정
- `harness run --mode <fast|safe|release>` — 모드별 권장 시퀀스
- `harness memory add` — eval-case 수동 적재
- `docs/QUALITY-CONTRACT.md`, `QUALITY-SCORE.md`, `FACTORY-CELLS.md`, `BENCHMARKS.md`, `INTEGRATIONS-OMC-ECC-HERMES.md` 신규
- `decision.json` v0.3 → v0.4 (qualityContract / qualityScore / factoryCells / architectureReview / designReview 5 필드 신규)
- `src/scoring/` — 8 영역 정량 점수 계산
- architecture rule 4 (large-file / layer-violation / untyped-api / circular-dep)
- design rule 3 (accessibility / design-token / responsive-break)

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
