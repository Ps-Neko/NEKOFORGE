# Self-host #4 — Codex Re-review Round

> 외부 Codex 가 self-host #3 결과를 재검증해 **3건 추가 부분 이행** 식별.
> 본 회차는 그 3건 + 의도된 한계의 정리. ROADMAP §10 Beta 의 "외부 사용자 PR" 영역에 두 번째 검증 누적.

## Codex 재검증 결과 (2026-05-19)

| # | 항목 | 심각도 | 본 회차 처리 |
|---|---|---|---|
| 1 | hooks 가 workflow 에 연결됐지만 외부 명령은 `skipped` | **Major** | `defaultExecutor` 가 외부 명령을 실제 `spawnSync` (timeout 60s, secret 마스킹) |
| 2 | `apply` 가 patch 격리는 했지만 워킹트리 미반영 | **Major** | apply 가 **워킹트리 drift 검증** (pending patch ↔ 현재 git diff 정확 일치 요구) → `ApplyDriftError` |
| 3 | memory 자동 적재 부재 (WORKFLOW.md 와 불일치) | Medium | CLI apply.ts 가 통과 시 `runMemoryAdd({kind:"milestone_passed"})` 자동 호출 |

## 14단계 흔적 요약

| 단계 | 본 회차의 결정 |
|---|---|
| intake | "Codex 재검증 3건 (#1 hooks 실행, #2 apply drift, #3 memory 자동)" |
| spec | 누가/왜/하지않을것/성공기준 (코드 자체가 ground truth) |
| plan | TASK-R1 (#1), TASK-R2 (#2), TASK-R3 (#3) 분해 |
| design | Pipeline (변경 규모 작음) |
| quality-policy | 기본 정책 유지 |
| team | impl-1 / sec-1 / rel-1 |
| work | hooks/runner.ts spawn 통합, apply/index.ts drift 검증, cli/apply.ts memory 자동, _seed.ts noop hooks |
| review | codex-stub passed (실제 외부 Codex 재검증이 본 회차 트리거 자체) |
| gate | PASS_WITH_WARNINGS (no-test-risk 가능) |
| apply | 통과 |
| memory | M-self-host-4-codex-rereview.json |

## 의미적 변화

### apply 의 의미 명확화

이전 (Phase D 후속):
> apply = pending patch → applied 로 격리 이동 (artifact 승격만)

본 회차:
> apply = (1) **현재 git diff 와 pending patch 정확 일치 검증** → drift 감지 시 거부, (2) 일치 시 applied 로 promote, (3) 사용자에게 commit/push 책임은 그대로 위임

**이 변화의 가치**: 사용자가 work 이후 워킹트리를 추가 변경하거나 부분 revert 했으면 apply 가 거부. work 시점의 diff 와 현재 워킹트리의 일치성이 보장됨. 자동 commit 은 여전히 안 함 (PRODUCT §7.2 차단 보장 유지).

### hooks 의 의미 명확화

이전 (Phase D 후속):
> hooks runner 가 work/review/apply 단계에 연결됐으나 외부 명령은 `skipped` 반환

본 회차:
> 화이트리스트(npm/npx/tsc/git 등)를 통과한 명령은 **실제 spawn 실행**. exit 0 이면 ok, 비-0 이면 failed (blocking 시 단계 거부). stderr 는 maskSecrets 통과 후 hook output 에 저장.

**이 변화의 가치**: `pre-tool/ts-typecheck` (npx tsc --noEmit) 같은 hook 이 실제 타입 오류 시 work 진입 차단. 사용자/agent 의 "테스트는 통과했는데 컴파일 에러는 안 잡힘" 같은 패턴 방지.

## 통과 기록

- `npm test` : **200/200 통과** (이전 194 + 본 회차 신규 6: spawn fake 5, drift 1)
- `npm run lint` : 0 위반
- `npm run depcheck` : 83 모듈, 210 의존성, 위반 0
- 외부 검증 사례 **2건 누적** (Codex 2회) → ROADMAP §10 Beta 진척

## 테스트 시드 변경

본 회차에서 hooks 의 실제 spawn 실행이 활성화됐기 때문에, `seedHarness` 와 `full-flow.test.ts` 가 **테스트 환경에서 외부 spawn 회피를 위해** policy 단계 후 `hooks.json` 을 `internal:noop` 으로 덮어쓴다. 실제 사용자 환경에서는 quality-policy 의 default (`npx tsc --noEmit` 등) 이 그대로 동작한다.

## eval-cases

- `M-self-host-4-codex-rereview.json` — 본 회차 통과 기록
- `codex-rereview-3-items.json` — 외부 점검 이벤트 보존
