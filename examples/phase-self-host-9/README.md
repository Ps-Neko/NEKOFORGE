# Self-host #9 — `--with-worker-stubs` 옵션 도입 후 깊이 검증

> self-host CLI 가 standard profile 3 worker (impl/test/sec) 의 result.{md,json} 을 자동 stub 시드하는 옵션 추가.

## 추가 옵션

```bash
$ harness self-host --with-worker-stubs --goal "<...>"
```

- 새 helper `seedWorkerStubs(cwd, taskId)` 가 3 worker 의 result 를 placeholder 로 시드.
- 각 stub: status=completed, findings=[], forbiddenActionsDeclared 명시.

## 정직성 주의

stub 은 placeholder. 다음 정직성 신호가 유지:

1. quality-contract failedBars 가 그대로 발화 (correctness:70<80, testCoverage:40<70).
2. score cap 이 그대로 적용 (verdict 자동 강등).
3. rule pack / skill pack 신호도 그대로 발화.

→ stub 으로 worker-missing-required 만 해소되지, 본 도구의 다층 약속 (rule + contract + score + rule-pack) 은 독립적으로 작동.

## 결과 (2026-05-20)

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW (자동 PASS 안됨 — 양호) |
| triggered rules | (none) — stub 으로 worker 신호 차단 |
| 강등 원인 | failedBars (correctness/testCoverage 기존 신호) |
| workerFactory.status | complete (3 stub 시드됨) |
| rulePacks | enabled 5 / 기존과 동일 |
| skillPacks | enabled 2 / 기존과 동일 |

## 의미

- stub 모드로 self-host 가 더 풍부한 자가 검증 가능 (workerFactory.complete 까지 도달).
- 단, stub 만으로 verdict 가 PASS 로 올라가지 않음 — 본 도구의 정직성 layer 가 stub 우회를 막음.
- 다음 회차 (#10, #11...) 에서도 stub 옵션 활용 가능.

## eval-case

- `M-self-host-9-milestone-passed.json` — 회차 통과 + stub 옵션 추가 기록
