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

| 지표 | 정의 | 현재 (25 fixture, v0.5.0-alpha) |
|---|---|---|
| `criticalRecall` | expected ∈ {BLOCK, NEEDS_HUMAN_REVIEW} 중 본 도구가 잡은 비율 | **1.000** |
| `falsePositiveRate` | expected = PASS 중 본 도구가 잘못 BLOCK/REVIEW 처리한 비율 | **0.000** |

**그룹별** : security 10 (positive 5 + negative 5) / architecture 6 (positive 4 + negative 2) / design 5 (positive 3 + negative 2) = **25 fixture** 모두 expected 매칭.

PASS-expected negative **10개** 누적 (Beta 진입 조건 #2 의 5배 마진). critical recall 1.0 + FP rate 0.0 는 본 25 fixture 한정. 사용자 환경에 fixture 추가 시 지표 변동.

## 4.A Cross-rule interference 회피 패턴 (self-host #11 발견)

fixture 작성 시 한 rule 의 negative 시나리오가 **다른 rule 의 positive 시나리오** 가 될 수 있다. 본 도구의 다층 약속이 fixture 자체에도 self-referential 하게 작용.

### 실측 사례

`auth-bypass` rule 의 negative (정상 auth 추가) fixture 를 `src/auth/middleware.ts` 에 작성하니 `dangerous-file-write` 가 정확히 발화. → fixture 의 의도 (auth-bypass 미발화) 검증이 verdict 강등으로 인해 실패.

### 회피 패턴

| 검증하려는 rule | 회피해야 할 다른 rule | 안전한 경로 후보 |
|---|---|---|
| `auth-bypass` | `dangerous-file-write` | `src/api/`, `src/services/` (auth/ 회피) |
| `secret-fallback` | `dangerous-file-write` | 일반 config 파일 (.env 회피) |
| `no-test-risk` | `test-deletion` | test 추가만, 기존 test rename/delete 회피 |
| `accessibility-risk` | `no-test-risk` | tsx 변경 + 동반 test 파일 함께 |
| `untyped-api-risk` | `no-test-risk` | src + tests 동시 변경 |

### 규칙

1. **fixture 의 의도가 한 rule 만** 이어야 한다 (`triggeredRules` 가 정확히 그 rule 1개).
2. **다른 rule 발화가 의도** 라면 expected.json 의 `triggeredRules` 에 명시.
3. negative fixture 는 가능하면 **다른 rule 의 안전 영역** 으로 작성.
4. 의심스러우면 작성 후 `npm run benchmark` 로 즉시 회수.

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
