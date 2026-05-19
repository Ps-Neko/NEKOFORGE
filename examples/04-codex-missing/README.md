# Example 04 — codex-missing-risk

> TASKS.md D-004 — 고위험 변경 + adapter 부재 시나리오.

## 시나리오 A (adapter 0개 → INSUFFICIENT_EVIDENCE)

`.harness/codex-findings.json` 의 `adapterId="none"` 상태에서 `.env` 변경 diff.

```text
gate → verdict = INSUFFICIENT_EVIDENCE
       triggered: dangerous-file-write (high) + codex-missing-risk (critical)
apply --approved → exit 4 (AutoApplyBlockedError)
```

T-SEC-14 e2e 가 본 시나리오를 자동 검증.

## 시나리오 B (adapter 1+ 등록 but not_run → NEEDS_HUMAN_REVIEW)

```text
gate → verdict = NEEDS_HUMAN_REVIEW
       triggered: dangerous-file-write + codex-missing-risk (high)
apply --approved → exit 3 (approval 없으면)
```

T-SEC-13 e2e 가 본 시나리오를 자동 검증.

## 파일

- `last-diff.patch` — `.env` 변경 (고위험 트리거)
- `codex-findings.no-adapter.json` — adapter 0개 시나리오 (시나리오 A 용)
- `codex-findings.not-run.json` — adapter 등록 but not_run (시나리오 B 용)
