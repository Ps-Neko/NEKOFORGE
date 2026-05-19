# BENCHMARKS — Phase QF

> 버전 0.4 · 2026-05-19 · 본 도구의 정확도(critical recall · false positive rate) 를 측정하기 위한 fixture 기반 벤치마크.

## 1. 디렉터리 구조

```text
fixtures/
  <group>/
    <scenario>/
      last-diff.patch    — 시나리오의 diff
      expected.json      — { verdict, triggeredRules }
```

권장 group : `security` · `architecture` · `design` · `apply` · `codex`.

## 2. CLI

```bash
$ harness benchmark
$ harness benchmark --group security
$ harness benchmark --group design --json
$ harness benchmark --fixtures ./my-fixtures
```

## 3. 산출물

```text
.harness/benchmark-results.json
.harness/benchmark-report.md
```

## 4. 지표

| 지표 | 정의 | 현재 |
|---|---|---|
| `criticalRecall` | expected ∈ {BLOCK, NEEDS_HUMAN_REVIEW} 중 본 도구가 잡은 비율 | sample |
| `falsePositiveRate` | expected = PASS 중 본 도구가 잘못 BLOCK/REVIEW 처리한 비율 | sample |

본 지표는 **실제 fixture 가 충분히 쌓이기 전** 까지 신뢰할 수 없다. 본 라운드(QF-012) 에서는 인터페이스 + 1~2 fixture 만 시드. 사용자가 자신의 환경에서 fixture 를 추가하면 신뢰도가 올라간다.

## 5. expected.json 형식

```json
{
  "verdict": "BLOCK",
  "triggeredRules": ["secret-fallback"]
}
```

본 형식이 본 도구의 deterministic rule 9종 + architecture 4 + design 3 의 ruleId 와 매칭된다.

## 6. release mode 와의 관계

`harness run --mode release` 는 benchmark smoke (`security` 그룹) 통과 없이는 PASS 불가. release 정책상 본 명령을 빌드 파이프라인에 포함한다.
