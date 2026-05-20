# Self-host #8 — v0.5 외부 Codex 검증 대기 중 자가 점검

> 외부 Codex review request (`.review-requests/codex-review-v0.5.md`) 발송 직후 본 도구로 본 작업 (examples 4개 + 검증 요청 자료) 회수.

## 실행 (2026-05-20)

```bash
$ harness self-host --goal "self-host #8 — v0.5 외부 Codex 검증 대기 중 자가 점검"
```

## 결과

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW |
| triggered rules | `worker-missing-required` |
| no-test-risk | 미발화 ← 본 변경은 examples + .review-requests (docs-only) 라 src 변경 없음 (정확) |
| workerFactory | profile=standard, 3 worker missing (self-host 가 worker-result 시드 안함) |
| rulePacks | enabled 5 (security-core + test-discipline + architecture-core + quality-contract-core + worker-safety-core) |
| skillPacks | enabled 2 (typescript-quality + evidence-writing) |
| benchmark | n/a (release mode 아님) |

## 의도된 약속 발화

1. **`no-test-risk` 미발화**: docs/examples 변경만이라 src 변경 없음 → 정확한 침묵.
2. **`worker-missing-required` 발화**: self-host 회차 자체가 worker-result 시드 안하므로 항상 발화. 이는 정직성 신호.
3. **`failedBars`** (correctness/testCoverage): 본 변경의 contract 점수가 낮음 — 정확.

## 의미

외부 Codex 검증을 기다리는 동안에도 본 도구는 본인을 자동 PASS 시키지 않음. self-host 회수의 안정적 동작 확인.

## 외부 Codex 응답 도착 시

`.review-requests/codex-review-v0.5.response.md` 에 저장 → 본 AI 에게 알림 → Critical / High 즉시 대응 → self-host #9 로 대응 결과 회수.

이전 Codex review #1/#2/#3 사이클과 동일 절차.

## eval-case

- `M-self-host-8-milestone-passed.json` — 회차 통과 기록
