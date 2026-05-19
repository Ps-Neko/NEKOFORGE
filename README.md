# NEKOFORGE — Verified AI Development Harness

> AI 가 코드를 만들 수는 있어도, AI 가 만든 변경은 **독립 검증과 사람 승인 없이 적용될 수 없다**. 이 한 줄을 실제로 강제하는 local-first CLI.

[NEKOWORK](https://github.com/Ps-Neko/NEKOWORK) 가 좁고 깊은 **검증 게이트**라면, NEKOFORGE 는 그 사상을 1개 단계(gate/apply)로 흡수해 **14단계 통합 공정**으로 확장한 가족 도구다. 7개 축(Gstack · Superpowers · ECC · revfactory/harness · OMC · Codex · NEKOWORK식 Gate)을 역할별로 분리해 직렬화한다.

버전 : 0.3 (Phase A~E 완료)
작성일 : 2026-05-18 (Phase A) · 2026-05-19 (Phase D 후속 + 이름 변경)

---

## 1. 이 도구가 아닌 것

- agent 카탈로그가 아니다.
- prompt 모음이 아니다.
- skill 셋이 아니다.
- Claude Code 설정 모음이 아니다.
- 자동 배포 도구가 아니다.

## 2. 이 도구가 하는 것

다음 14단계 공정을 **순서대로, 증거를 남기며, 차단 가능하게** 진행하도록 강제한다.

```text
intake → clarify → context → spec → plan
       → harness-design → quality-policy → team
       → work → self-review → codex-review
       → gate → apply → memory
```

핵심 약속 7가지(자세한 내용은 [docs/PRODUCT.md](docs/PRODUCT.md) §7):

1. **단계 분리** — 각 단계는 다른 명령으로만 진행된다.
2. **차단 보장** — `BLOCK` / `INSUFFICIENT_EVIDENCE` 상태에서 어떤 플래그로도 apply 되지 않는다.
3. **증거 보장** — 모든 결정은 사람이 읽는 `.md` 와 기계가 읽는 `.json` 으로 동시에 남는다.
4. **독립성 보장** — Codex 등 외부 리뷰 어댑터는 검증자이지 최종 승인자가 아니다.
5. **로컬 우선** — 외부 SaaS 없이 동작한다.
6. **도구 독립** — `.harness/` 가 core. `.claude/`, `.cursor/`, `.codex/` 는 export 결과물.
7. **설계·실행 분리** — "어떤 팀으로 일할지(design)" 와 "그 팀을 어떻게 운용할지(team)" 는 다른 단계다.

## 3. 30초 path (Phase B 구현 후 동작 예정)

```bash
# 1) 워크스페이스 초기화
$ harness init

# 2) 목표 적기 (원문 그대로 보존됨)
$ harness ask "사용자 로그인 실패 시 잠금 기능 추가"

# 3) 도메인·구조·제약 정리
$ harness context

# 4) 제품 질문 7개 강제 답변 → SPEC.md
$ harness spec

# 5) 작은 task 와 테스트 계획 → PLAN.md, TASKS.md
$ harness plan

# 6) 팀 패턴 선택 (Pipeline / Producer-Reviewer / ...) → team.json, orchestrator.md
$ harness design

# 7) rules / hooks / context-policy 묶음 → quality-policy.md, rules.json, hooks.json
$ harness policy

# 8) 실행 routing → team-runtime.md, agent-routing.json
$ harness team

# 9) task 1개 구현 (실제 코드 변경 후 호출)
$ harness work TASK-001

# 10) 자기 검토 + 외부 어댑터 검토
$ harness review

# 11) verdict 산출 → REPORT.md, .harness/decision.json
$ harness gate

# 12) verdict + 명시 승인 충족 시에만 적용
$ harness apply --approved

# 13) 현재 단계와 verdict 사람 친화 출력
$ harness report

# 14) (선택) Claude Code 형식으로 export
$ harness export claude
```

CLI 상세는 [docs/CLI.md](docs/CLI.md). 단계별 산출물은 [docs/WORKFLOW.md](docs/WORKFLOW.md).

## 4. 차단되는 행동들

다음은 본 도구가 **명시적으로 차단**하도록 설계된다. 우회 플래그는 제공하지 않는다 ([docs/SECURITY.md](docs/SECURITY.md) §6).

- 자동 git commit / push / deploy
- `BLOCK` 상태에서 `apply`
- `INSUFFICIENT_EVIDENCE` 상태에서 `apply`
- 사람 승인 없는 위험 파일(`.env`, CI, auth) 변경 적용
- 단일 외부 어댑터의 PASS 만으로 자동 승인
- decision.json 수동 위변조에 의한 PASS 위장
- agent 권한 겸직(`implementation-agent` + `security-reviewer` 동일 ID)
- hooks.json 화이트리스트 외 명령 추가
- export adapter 의 역방향 import (`.claude/` → `.harness/`)

## 5. 왜 `.harness/` 가 core 이고 `.claude/` 는 export 인가

```text
.harness/team.json       ──▶ harness export claude ──▶ .claude/agents/*.md
.harness/skills-map.json ──▶ harness export claude ──▶ .claude/skills/*.md
.harness/quality-policy.md ─▶ harness export claude ─▶ CLAUDE.md (포인터)
```

이유 :

- AI 도구는 자주 바뀐다(Claude Code → Codex → Cursor → ...). 도구별 디렉터리를 1급으로 두면 도구가 바뀔 때마다 작업이 망가진다.
- 본 도구의 검증 공정은 **도구에 묶이지 않는** 사실원이 필요하다.
- `.claude/`, `.cursor/`, `.codex/` 는 동일 `.harness/` 로부터 결정적으로 생성된다. 사람이 읽고 검토할 진실원은 `.harness/` 한 곳이다.

자세한 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §11.

## 6. 누가 쓰는가

- 혼자 코드 짜며 AI 를 일상적으로 쓰는 시니어 개발자
- 형식적인 PR review 에서 벗어나고 싶은 소규모 팀 리드
- 여러 AI 도구(Claude Code + Codex + Cursor 등)를 병행하는 사용자
- "사외로 소스가 나가면 안 되는" 환경에서 로컬 우선 검증이 필요한 개인·팀

이 도구가 **맞지 않는** 사용자도 명시되어 있다 — [docs/PRODUCT.md](docs/PRODUCT.md) §5.4.

## 7. 참고한 프로젝트와 흡수 범위

각각 "역할" 로만 차용. 코드 복제 없음. 자세한 매핑은 [docs/PRODUCT.md](docs/PRODUCT.md) §4.

| 참고 | 흡수한 역할 | 단계 | 비유 |
|---|---|---|---|
| Gstack | 제품 질문 · 스펙 압축 | clarify · spec | 기획실 |
| Superpowers | spec-first · plan-first · TDD | spec · plan · work | 개발 공정 표준서 |
| Everything Claude Code | rules · hooks · context · security 카탈로그 | quality-policy | 작업 매뉴얼 창고 + 자동 안전 센서 |
| revfactory/harness | 도메인 기반 팀 아키텍처 설계 | harness-design | 공장 설계 사무소 |
| OMC | 멀티 에이전트 실행 routing | team · work | 작업반 운영실 |
| Codex | 외부 독립 코드 검증 | codex-review | 외부 품질감사관 |
| NEKOWORK식 Verified Gate | verdict · decision.json · Human Gate | gate · apply | 출고 승인 게이트 |

## 8. 문서 지도

| 문서 | 답하는 질문 |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | 무엇을 위한 도구인가, 무엇이 아닌가 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 어떻게 구성되어 있는가 |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | 단계별로 무엇이 어떤 순서로 일어나는가 |
| [docs/HARNESS-DESIGN.md](docs/HARNESS-DESIGN.md) | 팀 패턴 6종 중 언제 어떤 것을 쓰는가 |
| [docs/QUALITY-POLICY.md](docs/QUALITY-POLICY.md) | 어떤 rules/hooks/context-policy 를 어떻게 묶는가 |
| [docs/SECURITY.md](docs/SECURITY.md) | 어떤 위험을 어떻게 차단하는가 |
| [docs/CLI.md](docs/CLI.md) | 명령 인자·exit code·도움말 형식 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 언제까지 무엇을 만드는가 |
| [TASKS.md](TASKS.md) | Phase B 에서 어떤 task 를 어떤 순서로 구현하는가 |

## 9. 현재 상태

- **Phase A — 문서 부트스트랩** : 완료 (10개 문서).
- **Phase B — MVP 구현 (M1·M2·M3a·M3b)** : 완료. CLI 14개 + rule 9종 + core 14단계 + T-SEC 16/16.
- **Phase C — self-hosting + memory 5건** : 완료 (audit.jsonl 자동 어펜드 + chain hash + anchor 도입을 본 도구 14단계로).
- **Phase D — real adapters + export 4종 + 의견 불일치 정책** : 완료 (claude/cursor/codex/generic export, codex/claude real adapter timeout + stderr 마스킹).
- **Phase E — 다언어 (Python/Go) 확장** : 완료.
- **Phase F — 협업 모델** : 보류 (외부 수요 조건부).
- `npm test` 현재 : **194/194 통과** (Phase E 까지 의 모든 회귀 + Phase C/D 후속 + Codex feedback 라운드 self-host #3).
- 외부 검증 사례 1건 누적 (Codex 2026-05-19) — examples/phase-codex-feedback/ 참고.
- 자세한 마일스톤 : [docs/ROADMAP.md](docs/ROADMAP.md) §9.

## 10. 기여·실행 정책

- 신규 기능은 본 도구 자신의 14단계 공정을 거쳐야 한다(self-hosting, Phase C).
- 새 deterministic rule 추가 절차 : [docs/SECURITY.md](docs/SECURITY.md) §4.
- 영구 비-목표(자동 배포·SaaS·역방향 import 등) : [docs/ROADMAP.md](docs/ROADMAP.md) §8.

## 11. 정체성 한 줄

```text
"제품 질문 → 도메인 정리 → 스펙 → 개발 계획 →
 팀 아키텍처 설계 → 품질 정책 → 팀 실행 →
 작은 task 단위 구현 → self-review → Codex 독립 검증 →
 deterministic gate → Human Gate → explicit apply"
를 강제하는 local-first AI Development Harness.
```

이 한 줄과 충돌하는 모든 추가 기능 제안은 우선 거부된다.
