# Self-host #10 — 문서 정합 마감 후 회수

> 5라운드의 문서 정합 작업 (CLI / ARCHITECTURE / WORKFLOW / SECURITY / HARNESS-DESIGN / QUALITY-POLICY / TASKS / RELEASE-NOTES / examples 인덱스) 직후 자가 검증.

## 정합 작업 누적 (#7 → #10)

| 라운드 | 정합 영역 |
|---|---|
| #7 후속 | self-host CLI 가 WF/RP 자동 시드 |
| #8 후속 | 외부 Codex v0.5 검증 요청 자료 |
| 1차 정합 | T-RP-04 e2e + docs/CLI.md §3.15~3.24 + ROADMAP + 버전 일괄 |
| 2차 정합 | README docs 목록 + ARCHITECTURE + WORKFLOW + examples 인덱스 |
| 3차 정합 | SECURITY worker safety findings + HARNESS-DESIGN role 매핑 + QUALITY-POLICY rule pack 연결 + TASKS phase 기록 + RELEASE-NOTES self-host 표 |
| #10 회수 | 본 회차 — 정합 마감 직후 self-host 자가 검증 |

## 결과 (2026-05-20)

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW (자동 PASS 안됨) |
| triggered rules | worker-missing-required (정확 — self-host 가 result 시드 안함, --with-worker-stubs 미지정) |
| 정합 작업의 영향 | doc-only 변경이라 deterministic rule 미발화 |
| workerFactory | profile=standard, 3 worker missing |
| rulePacks | enabled 5 (security-core + test-discipline + architecture-core + quality-contract-core + worker-safety-core) |
| skillPacks | enabled 2 (typescript-quality + evidence-writing) |

## 의미

- 5라운드 정합 후에도 본 도구의 정직성 유지 — doc-only 변경은 verdict 영향 0.
- 본 도구가 본 작업 (정합 작업) 을 자동 PASS 하지 않고 NEEDS_HUMAN_REVIEW 로 사람 검토 요구.
- 다음 외부 신호 (Codex review 응답 또는 외부 사용자 PR) 대기 상태.

## 누적 통계 (v0.5.0-alpha, self-host #10 시점)

- Tests: 277
- Benchmark: 20/20 (recall 1.000, FP 0.000)
- depcheck: 0 violations (121 modules)
- Docs: 19 (핵심 8 + 영역별 11)
- Examples: 20 (시나리오 10 + Phase 흔적 10)
- Self-host: 10회 통과
- External Codex review: 3회 통합 + v0.5 검증 요청 발송 대기

## eval-case

- `M-self-host-10-milestone-passed.json`
