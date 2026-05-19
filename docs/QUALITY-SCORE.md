# QUALITY SCORE — Phase QF

> 버전 0.4 · 2026-05-19 · gate 가 verdict 와 함께 산출하는 정량 품질 점수.

## 1. 8 영역 점수 (0-100)

| 영역 | 가중치 | 계산 방식 (결정적) | 신뢰도 |
|---|---|---|---|
| `correctness` | 0.20 | 테스트 통과 + critical/high finding | 높음 |
| `testCoverage` | 0.15 | testStatus + no-test-risk finding | 중간 (c8 미통합) |
| `security` | 0.20 | secret/auth/dangerous/hook/agent rule finding | 높음 |
| `maintainability` | 0.15 | architecture finding (크기·중복) | 중간 |
| `architecture` | 0.15 | layer-violation, circular-dep finding | 높음 |
| `ux` | 0.05 | design finding (uiTouched 시만) | **낮음** |
| `performance` | 0.05 | testStatus 만 (벤치 미통합) | **낮음** |
| `evidence` | 0.05 | artifact 완전성 | 높음 |

`ux`/`performance` 의 신뢰도가 낮은 이유 : LLM 호출 없이는 정량 평가 어려움. 본 도구는 가중치를 낮게 둬서 영향 제한.

## 2. Verdict 매핑

```text
critical rule finding 또는 evidence 누락       → BLOCK / INSUFFICIENT_EVIDENCE (점수 무관)
overall >= 85 + critical/high 없음 + test pass → PASS
75 <= overall < 85                              → PASS_WITH_WARNINGS
60 <= overall < 75                              → NEEDS_HUMAN_REVIEW
overall < 60                                    → NEEDS_HUMAN_REVIEW (보수적)
required quality bar 미달                       → 최소 NEEDS_HUMAN_REVIEW
```

gate 는 **verdictBase (rule 기반)** 와 **scoreCap (점수 기반)** 중 **더 보수적인 것** 을 채택한다.

## 3. quality-score.json 형식

```json
{
  "schemaVersion": "0.4",
  "taskId": "TASK-001",
  "scores": { "correctness": 0, ..., "overall": 0 },
  "weights": { "correctness": 0.20, ... },
  "thresholds": { "pass": 85, "passWithWarnings": 75, "needsHumanReview": 60, "blockBelow": 60 },
  "reasons": [],
  "failedQualityBars": ["security:60<90"]
}
```

## 4. 본 문서가 답하지 않는 것

- 점수 영역 가중치 변경 → quality-contract.json 의 `qualityBars` 로 영역별 `minimum` 만 조절 가능. 가중치 자체는 본 도구 default.
- LLM 호출 기반 정성 평가 → 향후 후속 (Phase QF 2차)
