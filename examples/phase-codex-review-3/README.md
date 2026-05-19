# Self-host #5 — Codex Review #3 Round

> 외부 Codex 가 QF self-host 결과를 재검증해 **5건 추가 부분 이행** 식별 (Critical 2 + Major 2 + Medium 1).
> Quality Factory Upgrade 의 핵심 강제 조건 일부가 아직 뚫린다는 지적. ROADMAP §10 Beta 검증 누적.

## Codex review #3 결과 (2026-05-18)

| # | 항목 | 심각도 | 본 회차 처리 |
|---|---|---|---|
| 1 | `quality-contract.json` / `quality-score.json` 없이도 apply 통과 | **Critical** | apply 의 Evidence before Apply 강화 — contract/score/REPORT 존재 + schema valid 모두 검증, decision.qualityContract.status=violated 또는 qualityScore.status=failed 면 거부 |
| 2 | contract 가 schema invalid 여도 verdict 영향 없음 | **Critical** | gate 가 `quality-contract-invalid` critical finding 추가 + `scoreCap = INSUFFICIENT_EVIDENCE` 적용 |
| 3 | UI 변경 감지 가 `riskProfile.uiTouched` 플래그 only | **Major** | diff 의 파일 경로 (`.tsx/.jsx/.css/.scss/.sass/.html` 또는 `components/app/pages/ui` 디렉터리) 로 자동 활성 (`detectUiInDiff`) |
| 4 | factory-cells / architecture-review / design-review 가 REPORT.md 안에만 존재 | **Major** | gate 가 5개 별도 산출 파일 추가 작성: `factory-cells.json`, `factory-cells.md`, `architecture-findings.json`, `architecture-review.md`, `design-findings.json`, `design-review.md` |
| 5 | decision.json schemaVersion 가 0.3 그대로 | Medium | `schemaVersion: "0.4"` 로 갱신 (테스트 시드 일괄 갱신) |

## 14단계 흔적 요약

| 단계 | 본 회차의 결정 |
|---|---|
| intake | "Codex review #3 — QF 5건 (Critical 2 + Major 2 + Medium 1)" |
| spec | 누가/왜/하지않을것/성공기준 (코드 자체가 ground truth) |
| plan | TASK-CR3-1~5 분해 |
| design | Pipeline (변경 규모 중간) |
| quality-policy | 기본 정책 유지 |
| team | impl-1 / sec-1 / rel-1 |
| work | `src/core/apply/index.ts` Evidence 강화 / `src/core/gate/index.ts` schema invalid 처리 + diff 기반 UI 감지 + 5 산출 파일 + schemaVersion 0.4 / `src/schemas/decision.schema.ts` 0.4 const |
| review | codex-stub passed (실제 외부 Codex 재검증이 본 회차 트리거) |
| gate | PASS_WITH_WARNINGS 예상 (no-test-risk 가능) |
| apply | 통과 (Evidence before Apply 자체가 새 약속) |
| memory | M-self-host-5-codex-review-3.json |

## 의미적 변화

- **apply 의 책임 명확화**: "verdict 만 보고 통과시키는 게이트" 가 아니라 "evidence 4종 (decision, quality-contract, quality-score, REPORT) 모두 유효 + verdict + drift 검증" 의 종합 차단점이 된다. apply 가 진짜 "출시 승인" 단계로 격상.
- **contract schema 정직성**: invalid 한 contract 는 더 이상 무시되지 않고 `INSUFFICIENT_EVIDENCE` 로 강등된다. 사용자가 contract 를 깨뜨리면 verdict 가 정직하게 반응.
- **UI 감지 의 자동화**: 개발자가 `uiTouched: true` 를 잊어도 `*.tsx`, `app/components/pages/ui` 패스가 자동 트리거. 디자인 리뷰 의 누락 위험 감소.
- **산출 파일 분리**: factory cells / architecture / design 가 외부 도구로 grep / parse 가능한 독립 artifact 가 됨. REPORT.md 는 사람이 읽는 종합 보고서, JSON 은 기계가 읽는 진실 소스.
- **schemaVersion 갱신**: 외부 도구 가 0.3 vs 0.4 로 호환성 분기 가능.

## 의도된 한계 (Phase QF 2회차에서 다룰 항목)

- score 의 ux/performance: 정적 휴리스틱이므로 5% 가중치 유지
- design rules: token / a11y / responsive 3종만, 디자인 시스템 통합은 추후
- patch 격리 후 실제 적용은 여전히 사용자 책임 (NEKOFORGE 는 검증 게이트 — 코드 변경 도구가 아님)

본 회차의 5건 처리가 NEKOFORGE 의 "evidence-based gate" 정체성을 더 단단하게 했다. 다음 외부 검증 시 어떤 약속이 뚫리는지가 다음 사이클의 입력.
