# QUALITY CONTRACT — Phase QF

> 버전 0.5 · 2026-05-19 · `work` 단계 진입 전 강제되는 품질 계약.

## 1. 본 단계의 책임

```text
입력 : .harness/SPEC.md (그리고 모든 이전 단계 산출물)
처리 : productIntent + acceptanceCriteria + qualityBars + riskProfile 채움
출력 : .harness/QUALITY-CONTRACT.md (사람용) + .harness/quality-contract.json (schema 검증)
```

## 2. 강제 조건

| 시점 | 조건 |
|---|---|
| `harness work <task>` | `quality-contract.json` 부재 시 거부 (exit 10) |
| `harness gate` | schema 위반 시 verdict 강제 `INSUFFICIENT_EVIDENCE` |
| `harness apply --approved` | `qualityBars.required=true` 항목 미달 시 verdict 상한 `NEEDS_HUMAN_REVIEW` |

## 3. 4 종 template

| Template | 강조 영역 | qualityBars 차이 |
|---|---|---|
| `web-ui` | UX | ux=80(required), security=90, evidence=90 |
| `cli-tool` | Correctness · UX 낮음 | correctness=85, ux=60 |
| `backend-api` | Security · Performance | security=95(required), performance=80(required), evidence=95 |
| `library` | Coverage · Maintainability | testCoverage=85, maintainability=90 |
| `custom` | 기본 8 영역 균등 | 사용자 정의 |

## 4. quality-contract.json 형식

`src/schemas/quality-contract.schema.ts` 참고. 주요 필드:

```json
{
  "schemaVersion": "0.5",
  "taskId": "TASK-001",
  "productIntent": { "user": "", "problem": "", "coreValue": "", "nonGoals": [] },
  "acceptanceCriteria": [],
  "qualityBars": { "<area>": { "minimum": 0-100, "required": true|false } },
  "riskProfile": { "authTouched": bool, "uiTouched": bool, ... },
  "requiredEvidence": ["SPEC.md", "PLAN.md", "quality-contract.json", ...],
  "forbiddenActions": ["auto-commit", "auto-push", "auto-deploy", ...],
  "template": "web-ui" | "cli-tool" | "backend-api" | "library" | "custom"
}
```

## 5. CLI 사용 예

```bash
# 4 종 template 중 선택
$ harness contract --template backend-api --task TASK-001

# answers.json 으로 productIntent 미리 채움
$ harness contract --answers ./intent.json

# 기존 contract 검증
$ harness contract --check
```

## 6. spec 과의 관계 (fast mode)

`harness run --mode fast` 에서는 `spec` 을 건너뛴다. 대신 quality-contract 의 `productIntent` 가 **Gstack식 7문항을 흡수**한다 (누가/문제/핵심가치/하지않을것/...).

## 7. 본 문서가 답하지 않는 것

- 점수 계산 알고리즘 → QUALITY-SCORE.md
- 14단계 → 6 cell 매핑 → FACTORY-CELLS.md
