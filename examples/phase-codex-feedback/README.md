# Self-host #3 — Codex Feedback Round

> 외부 Codex 가 v3 프롬프트와 NEKOFORGE 코드 베이스를 점검해 **6건의 부분 이행**을 식별.
> ROADMAP §10 Beta 조건의 "외부 사용자 1명 이상 PR 머지" 시뮬레이션 사례.
> 본 라운드의 14단계 진행은 NEKOFORGE 가 자기 자신을 자기 도구로 검증한 self-host #3 회차다.

## 점검 결과 (Codex, 2026-05-19)

| # | 항목 | 본 라운드 처리 |
|---|---|---|
| 1 | explicit apply 가 patch 격리 미사용 | `.harness/pending/<task>.patch` 도입 + apply 가 `.harness/applied/` 로 이동 |
| 2 | hooks 미연결 | work 의 pre-tool/post-tool, review 의 post-review, apply 의 pre-apply 통합 |
| 3 | 산출물 placeholder | **의도된 한계로 인정 + SECURITY.md 명시** (본 도구는 산출물 골격만 책임) |
| 4 | memory CLI 미연결 | `harness memory add` 신규 subcommand |
| 5 | `--workspace` 무시 | cli/index.ts 의 main 에서 argv 의 `--workspace` 를 `HARNESS_WORKSPACE` env 로 변환 |
| 6 | apply_refused audit 미발화 | CLI apply.ts 의 catch 블록에서 `appendAuditEvent({type:"apply_refused"})` |

## 14단계 흔적 요약

| 단계 | 본 회차의 결정 |
|---|---|
| intake | "Codex 점검 결과 6건 대응 + self-host #3" |
| spec | 누가/왜/문제/핵심기능/하지않을것/성공기준/실패기준 (코드 자체가 ground truth) |
| plan | TASK-CF1 ~ TASK-CF6 분해 |
| design | Pipeline 유지 |
| quality-policy | 기본 정책 유지 |
| team | impl-1 / sec-1 / rel-1 |
| work | 신규/수정 ~10 파일 |
| review | codex-stub passed (실제 외부 codex 점검은 본 라운드 트리거 자체) |
| gate | verdict = PASS_WITH_WARNINGS (no-test-risk 가능) |
| apply | 통과 |
| memory | eval-cases/M-self-host-3-codex.json |

## 통과 기록

- `npm test` : 194/194 (이전 190 + 본 회차 신규 4: hooks blocking, memory write, patch isolation 2)
- `npm run lint` : 0 위반
- `npm run depcheck` : 83 모듈, 206 의존성, 위반 0
- 외부 검증 사례 1건 누적 → ROADMAP §10 Beta 조건의 "외부 PR" 영역 진척

## eval-cases (이 디렉터리)

- `M-self-host-3-codex.json` — self-host #3 통과 기록
- `codex-feedback-6-items.json` — 외부 점검을 정식 eval-case 로 보존
