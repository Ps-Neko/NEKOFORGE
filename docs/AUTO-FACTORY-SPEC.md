# AUTO-FACTORY — `harness auto` 설계 스펙 (WF-3 phase 1, walking skeleton)

> **상태**: 설계 확정 (2026-05-25). 본 문서 승인 후 구현 계획(plan)으로 넘어간다.
> **관련**: [FUTURE-WORKER-RUNTIME.md](FUTURE-WORKER-RUNTIME.md) (WF-3 계획) · [WORKER-FACTORY.md](WORKER-FACTORY.md) · `src/workers/adapter.ts` (어댑터 인터페이스).
> **전제**: moat 하드닝 포트(`feat/port-moat-hardening`) 베이스 위에서 작업. 브랜치 `feat/auto-factory-skeleton`.

## 0. 한 줄 요약 (비개발자용)

명령 한 줄(`harness auto "목표"`)로 공장이 **끝까지 한 바퀴** 돈다:
**AI가 코드를 짜고 → deterministic 게이트가 검사하고 → 사람의 승인에서 멈춘다.**

이 첫 버전은 "얇은 뼈대(walking skeleton)"다. 모든 단계를 깊게 자동화하지 않는다.
대신 **전체 루프가 도는지 / 게이트가 진짜 멈추는지 / 비용 상한이 먹는지**를
한 개의 작은 task로 먼저 증명한다. 그 다음에 각 부품을 깊게 만든다.

## 1. 배경 · 정체성 정합

- 사용자 결정(2026-05-25): 스마트 팩토리 = **"자동 진행 + 사람이 최종 출고 결정"(A)** + 코드 작성까지 AI 자동(선택 2).
- 이는 `FUTURE-WORKER-RUNTIME.md`의 **WF-3**("worker 자동 LLM 실행")을, 문서가 정한 진입 조건(외부 사용자 ≥1건 등 신호 2개)이 **아직 0개 충족인 상태에서 의식적으로 앞당겨** 여는 것이다. 사용자 명시 승인 하에 진행.
- WF-3의 **하드 비-목표는 그대로 유지**한다:
  - 무인 autonomous loop 금지 — **사용자 명시 호출(`harness auto`)만**.
  - worker가 직접 apply / commit / push / deploy 금지.
  - background long-running runtime / tmux 금지.
  - 외부 SaaS 의존 강제 금지.

## 2. 목표 (이 스켈레톤이 하는 것)

- CLI: `harness auto "<goal>" [--task <id>] [--adapter claude|codex] [--max-cost <USD>] [--dry-run]`
- **foreground 단발 실행.** 백그라운드 · 데몬 · 루프 없음.
- 자동 진행(전체 구조 단계): `ask → context → spec(--answers 자동) → plan → design(--pattern 기본) → policy → team → contract(--template) → work(AI) → self-review → review → gate → 정지`.
  - **구조 단계는 기존 비대화형 옵션**(`--non-interactive` / `--answers` / `--pattern` / `init --preset`)을 엮어 자동 진행한다. AI는 **`work` 단계에만** 쓴다.
  - ※ gate는 12종 `REQUIRED_EVIDENCE`가 없으면 `INSUFFICIENT_EVIDENCE`로 단락된다 → `auto`가 단계를 "건너뛰지" 못하는 이유. 구조 단계 전부를 기본값으로 생성해 **증거 체인을 채워야** 실제 verdict가 나온다.
- `work` 단계에서 **실제 WorkerAdapter(claude/codex)가 코드 diff 생성** (기존 stub 대체).
- gate 후 verdict + REPORT 출력하고 **Human Gate에서 정지** — apply는 사용자가 별도(`harness apply --approved`).
- **비용 가드**: AI 호출 누적이 `--max-cost` 초과 예상 시 호출 *전*에 중단.

## 3. 비-목표 (정체성 보존)

**[영구 — 어느 슬라이스에서도 금지]**
- 자동 apply / commit / push / deploy. `BLOCK`·`INSUFFICIENT_EVIDENCE`는 어떤 플래그로도 apply 불가(기존 불변식 그대로).
- background autonomous loop / long-running runtime / tmux.

**[이 스켈레톤 한정 — 후속 슬라이스로 연기]**
- 구조 단계(spec/plan/design/policy 등)의 **AI 자동 생성** — 현재는 기존 비대화형 기본값·템플릿으로 채운다(AI가 SPEC 내용을 쓰진 않음; AI는 `work`에만). AI 생성은 §10.
- 멀티 task 연속 · 멀티 worker(impl+test+sec) · checkpoint resume · gemini 어댑터 · 정밀 토큰/비용 모델.

## 4. 아키텍처

| 신규/변경 | 위치 | 역할 |
|---|---|---|
| 신규 | `src/core/auto/index.ts` | `runAuto(input, deps)` 오케스트레이터. **기존 stage 함수들을 순서대로 호출**(재사용, 중복 구현 금지). |
| 신규 | `src/workers/adapters/claude.ts` (1순위) | 실제 `WorkerAdapter` 구현. `available()` 가드. AI 호출 → resultMd + 생성 diff. |
| 신규(후속) | `src/workers/adapters/codex.ts` | 동일 인터페이스. *Codex CLI는 Windows 마찰 이력 → claude 어댑터 먼저.* |
| 신규 | `src/core/auto/cost-guard.ts` | 사전 예상 + 호출별 누적, 초과 시 중단. |
| 변경 | `src/workers/adapter.ts` | `resolveWorkerAdapter`에 claude 실어댑터 등록(현재 shell-stub만). |
| 신규 | `src/cli/commands/auto.ts` | `harness auto` 명령 배선. |

- **gate 정지**: 기존 `runGate` 재사용 → verdict/REPORT/decision.json 쓰고, "`harness apply --approved`로 승인" 안내 후 종료(**apply 호출 안 함**).
- **감사**: 각 AI 호출을 `audit.jsonl`에 기록(WF-3 §5: LLM 호출 추적성).

## 5. 데이터 흐름

```text
goal
 → .harness/intake.md
 → (기본값) SPEC.md / PLAN.md / quality-contract.json
 → AI 어댑터 dispatch (task 프롬프트)
 → AI가 파일 편집 → git diff 캡처 → .harness/last-diff.patch
 → gate (deterministic 룰 + computeVerdict)
 → REPORT.md + decision.json
 → 정지 (humanApprovalRequired=true, apply 미수행)
```

## 6. `work` 단계 메커니즘 (가장 위험한 핵심 — 스켈레톤의 주 증명 대상)

1. `auto`가 작업 브랜치(또는 격리 워크스페이스)에서 시작.
2. claude 어댑터에 task 프롬프트(spec/plan 기반) 전달 → AI가 파일 편집.
3. `auto`가 `git diff` 캡처 → `last-diff.patch`.
4. 이후 **기존 gate가 그 diff를 검사**(룰은 결정적 유지).

- **비결정성 격리**: AI 출력은 매번 다르다 → 이 경로는 fixture/benchmark 결정성에서 분리한다. gate 룰 자체의 결정성은 불변.
- **안전**: AI가 만든 결과물에 `detectForbiddenActions` 적용(자동 실행이라 더 중요 — WF-3 §5).

## 7. 에러 처리

| 상황 | 동작 |
|---|---|
| 어댑터 unavailable | 명확한 메시지 + 중단 (조용한 skip 금지). |
| 비용 초과 예상 | AI 호출 *전* 중단 + 현재까지 지출 보고. |
| 단계 실패 | 정지 + 실패 단계 보고 + 증거(.harness) 보존. |
| verdict BLOCK/INSUFFICIENT | 게이트에서 정지(미적용, 기존대로). |

## 8. 테스트 (TDD)

- **결정성 원칙**: 테스트는 **주입된 가짜(fake) 어댑터**를 쓴다(라이브 claude 호출 금지 — 비결정·비용·CI claude.exe 부재). 실제 claude 어댑터는 별도 **수동 smoke 1회**로 검증.
- unit: 오케스트레이터 단계 순서; cost-guard 예산 초과 중단; 어댑터 unavailable 처리; **게이트 정지가 apply를 절대 호출 안 함**.
- unit: worker 어댑터(fake)가 diff 반환; AI 출력에 `detectForbiddenActions` 적중.
- e2e: 임시 git repo에서 `harness auto --adapter fake` → 게이트까지 진행 → verdict 생성 → **apply 미수행** → 종료코드가 정지 반영. 위험 심은 fake 출력 → `BLOCK`, apply 거부.
- e2e: `--max-cost 0` → AI 호출 *전* 중단.

## 9. 수용 기준 (이게 다 되면 스켈레톤 완료)

- **AC1**: `harness auto "<goal>"` 한 줄이 intake → gate까지 자동 진행한다.
- **AC2**: `work` 단계에서 (fake) 어댑터가 코드 diff를 생성하고 그 diff가 gate로 흐른다.
- **AC3**: gate 후 Human Gate에서 정지 — 어떤 경로로도 자동 apply 하지 않는다.
- **AC4**: `--max-cost` 초과 예상 시 AI 호출 전 중단 + 지출 보고.
- **AC5**: 실제 claude 어댑터 수동 smoke 1회로 "AI가 진짜 코드 생성 → gate까지" 확인.
- **AC6**: 전체 테스트 green(기존 323 + 신규), typecheck/lint/depcheck clean.

## 10. 후속 슬라이스 (이 스펙 밖)

`spec/plan/design/policy`를 AI가 자동 생성 · 멀티 task 연속 · 멀티 worker(impl+test+sec) · checkpoint resume · codex·gemini 어댑터 · 정밀 비용/토큰 모델 · `examples/`에 auto 시나리오 추가.

## 11. 본 문서가 답하지 않는 것

- 어댑터 인터페이스 상세 → `src/workers/adapter.ts` + `FUTURE-WORKER-RUNTIME.md`
- gate verdict 알고리즘 → `docs/WORKFLOW.md` §3.12 + `src/core/gate/verdict.ts`
- worker safety 강제 → `docs/WORKER-SAFETY.md`
- 영구 비-목표 정책 → `docs/ROADMAP.md` §8
