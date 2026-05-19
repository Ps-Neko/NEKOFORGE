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

| 지표 | 정의 | 현재 (12 fixture) |
|---|---|---|
| `criticalRecall` | expected ∈ {BLOCK, NEEDS_HUMAN_REVIEW} 중 본 도구가 잡은 비율 | **1.000** |
| `falsePositiveRate` | expected = PASS 중 본 도구가 잘못 BLOCK/REVIEW 처리한 비율 | **0.000** |

**그룹별** : security 6 / architecture 3 / design 3 = 12 fixture 모두 expected 매칭. critical recall 1.0 + FP rate 0.0 는 본 12 fixture 한정. 사용자가 자기 환경에서 fixture 를 추가하면 지표가 변동될 수 있다 (사용자 추가 권장).

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
