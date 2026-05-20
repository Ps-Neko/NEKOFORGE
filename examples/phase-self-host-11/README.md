# Self-host #11 — Negative fixture 10건 확장 후 회수

> Beta 진입 조건 #2 (FP 5개) 마진을 2배 확대 (5 → 10). Benchmark 의 false-positive 측정 신뢰도 강화.

## 추가된 negative fixture 5건

| 디렉터리 | 시나리오 |
|---|---|
| `design/css-variable-token-negative/` | `color: var(--text)` CSS 변수 사용 — design-token-violation 미발화 |
| `design/responsive-utility-negative/` | Tailwind `md:w-1/2 lg:w-1/3` 유틸 사용 — responsive-break 미발화 |
| `architecture/api-with-types-negative/` | 명시 return type 의 export function 추가 — untyped-api-risk 미발화 |
| `architecture/small-imports-negative/` | 2 sibling import 만 (threshold ≥3 미만) — circular-dependency-risk 미발화 |
| `security/profile-header-check-negative/` | src/api/ 의 authorization header 검사 추가 — auth-bypass 미발화 + dangerous-file-write 회피 |

기존 5건과 합쳐 PASS-expected negative **10개**:
- (기존) design/aria-improvement, design/docs-only, security/src-with-test, security/test-only-fix, architecture/import-shuffle

## 발견·해결

1차 시도에서 `auth-test-env-negative` 가 src/auth/ 경로로 작성됐다가 `dangerous-file-write` 가 정확히 발화. 본 fixture 의 의도 (auth-bypass 미발화) 를 검증하려면 다른 path (src/api/) 가 필요. 디렉터리명도 `profile-header-check-negative` 로 변경.

→ **fixture 작성 자체가 본 도구의 다른 rule 발화 영향을 받음**. 의도된 한 rule 만 평가하려면 다른 rule 발화 회피가 필요. 본 발견은 fixture 운영 가이드 추가 후보.

## 결과 (2026-05-20)

| 항목 | 결과 |
|---|---|
| benchmark | **25/25 통과** (이전 20 + negative 5) |
| critical recall | 1.000 |
| FP rate | 0.000 |
| self-host #11 verdict | NEEDS_HUMAN_REVIEW (정확 — worker-missing-required) |
| tests | 277/277 |

## 의미

Beta 진입 조건 #2 (FP 5개) 마진 2배 (5 → 10). benchmark 의 FP rate 측정이 더 신뢰 가능 — 작은 변경에도 false-positive 발생 시 즉시 감지.

## eval-case

- `M-self-host-11-milestone-passed.json`
- `fixture-cross-rule-interference-useful.json` — fixture 작성 시 다른 rule 발화 영향 발견
