# Phase C — Self-hosting Dogfood Artifacts

> 본 디렉터리는 Phase C (ROADMAP §4) 의 산출물이다.
> "본 도구로 본 도구의 다음 기능을 추가" 한 self-hosting 흔적을 보존한다.

## 1. 추가된 기능

`audit.jsonl` 자동 어펜드 — SECURITY.md §9 와 짝.

- `src/utils/audit.ts` : 비동기·동기 append 헬퍼.
- `src/cli/index.ts` : `command_start` 진입 + `process.on("exit")` 시 `command_end`.
- `src/core/gate/index.ts` : verdict 산출 후 `gate_verdict` 이벤트.
- `src/core/apply/index.ts` : `apply_attempt` 이벤트.
- 단위 테스트 : `tests/unit/utils/audit.test.ts`.

## 2. 14단계 흔적 (요약)

다음 14단계를 본 도구로 직접 진행했다고 가정한 산출물 시드.
실제 변경 적용 후 `.harness/` 는 .gitignore 되므로,
재현 가능하도록 본 디렉터리에 사본으로 보존.

| 단계 | 산출물 (이 디렉터리 내 사본) |
|---|---|
| intake | `intake.md` |
| spec | `SPEC.md` |
| plan | `PLAN.md`, `TASKS.md` |
| harness-design | `harness-design.md`, `team.json` (요약) |
| quality-policy | `quality-policy.md` |
| gate | `REPORT.md` |
| apply | `apply-log.md` |
| memory | `eval-cases/*.json` (13건: milestone 4 + rule 별 9건) |

(`clarify.md`, `context.md`, `orchestrator.md`, `skills-map.json`, `rules.json`, `hooks.json`,
`context-policy.md`, `team-runtime.md`, `agent-routing.json`, `worklog.md`, `self-review.md`,
`codex-findings.json` 은 템플릿과 동일하므로 본 사본에서는 생략.)

## 3. eval-case 13건 의미

milestone (Phase B/C 통과 기록):
- `M1-milestone-passed.json` — CLI 골격 통과
- `M2-milestone-passed.json` — rule 9종 unit test 통과
- `M3a-milestone-passed.json` — core 14단계 + adapter + CLI 통합 통과
- `M3b-milestone-passed.json` — T-SEC 16/16 통과

rule 별 발화 사례 (Beta 진입 조건 — rule 9종 모두 1건씩):
- `secret-fallback-empty-fallback-useful.json` — secret-fallback (false positive 차단)
- `auth-bypass-py-comment-useful.json` — auth-bypass (Python 확장)
- `test-deletion-go-skip-useful.json` — test-deletion (Go 확장)
- `no-test-risk-import-shuffle-fp.json` — no-test-risk (false positive 차단)
- `dangerous-file-write-env-example-conservative.json` — dangerous-file-write
- `hook-injection-postinstall-useful.json` — hook-injection-risk
- `agent-permission-impl-and-security-useful.json` — agent-permission-risk
- `auto-apply-block-insufficient-useful.json` — auto-apply-block
- `codex-missing-adapter-zero-critical-useful.json` — codex-missing-risk

## 4. 다음 단계

Phase D (외부 어댑터 실연결) 진입 조건은 ROADMAP §5.
