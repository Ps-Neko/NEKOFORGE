# Self-host #12 — placeholder rule 10종 휴리스틱 + weakness-cleanup 마감

> Phase RP-2 의 placeholder rule 10종 휴리스틱 일괄 구현 + 외부 사용자 자료 (weakness-cleanup) 마감 직후 자가 검증.

## 본 회차의 변경 (1줄 요약)

- 10 신규 deterministic rule:
  - **docs**: missing-cli-doc-risk (warning), broken-doc-link-risk (info)
  - **release-evidence**: missing-self-host-risk (info) / missing-migration-note-risk (info) / missing-external-review-risk (info)
  - **api-safety**: missing-auth-boundary-risk (warning)
  - **frontend**: missing-focus-state-risk (warning) / missing-loading-state-risk (info) / contrast-token-risk (info)
  - **dependency**: lockfile-mismatch-risk (warning)
- 등록: ALL_API_RULES 3→4 / ALL_DEPENDENCY_RULES 3→4 / ALL_DOCS_RULES 1→3 / ALL_RELEASE_EVIDENCE_RULES 1→4 / ALL_FRONTEND_RULES 1→4
- 총 deterministic rule **25 → 35**

## 결과 (2026-05-20)

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW |
| triggered rules | `no-test-risk` + `worker-missing-required` |
| benchmark | **30/30** (fixture caret-version-negative 의 lockfile 동반 추가로 lockfile-mismatch 회피) |
| tests | 292/292 |
| 총 rule | 25 → **35** |

## 의미

- 본 도구가 본 작업 (placeholder rule 추가) 을 자동 PASS 하지 않고 NEEDS_HUMAN_REVIEW 로 사람 검토 요구.
- 새 rule 들 중 info 등급 다수 (broken-doc-link / missing-self-host / missing-migration / missing-external-review / missing-loading-state / contrast-token) → verdict 영향 없이 알림. 다층 신호의 자연스러운 추가.
- benchmark fixture caret-version-negative 가 새 rule (lockfile-mismatch) 발화 → cross-rule interference 회피 (lockfile 동반 변경 추가). BENCHMARKS.md §4.A 의 패턴 실적 확인.

## eval-cases

- `M-self-host-12-milestone-passed.json`
- `placeholder-rules-10-implemented-useful.json`
