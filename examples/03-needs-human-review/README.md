# Example 03 — NEEDS_HUMAN_REVIEW + approval token

> TASKS.md D-003 — `.env` 변경 + approval.txt 유/무 비교.

## 시나리오

`.env` 의 `PORT` 값을 변경하는 diff 가 들어왔다. dangerous-file-write 가 high 로 발화.

```diff
diff --git a/.env b/.env
@@ -1 +1 @@
-PORT=3000
+PORT=4000
```

## 흐름 (토큰 없음)

```text
harness review   → codex stub passed
harness gate     → verdict = NEEDS_HUMAN_REVIEW
                   triggered: dangerous-file-write
harness apply --approved
   → ApplyApprovalError (exit 3)
   → .harness/approval.txt 부재 또는 토큰 mismatch
```

## 흐름 (토큰 추가 후)

`.harness/approval.txt` 에 다음 토큰을 추가한 뒤 다시 apply :

```text
approve TASK-001 verdict=NEEDS_HUMAN_REVIEW finding=DFW-2026-05-19-001 by=mmjs1220 at=2026-05-19T10:00Z
```

```text
harness apply --approved → ok, applied
```

## 메모

- 토큰의 `taskId` 와 `verdict` 가 decision.json 과 정확히 일치해야 한다.
- gate 재실행 시 finding/verdict 가 바뀌면 기존 토큰은 자동 무효화 (SECURITY §5.2).
- T-SEC-06 / T-SEC-10 e2e 가 두 흐름을 모두 검증.

## 파일

- `last-diff.patch` — 발화 트리거 diff
- `approval-good.txt` — 통과 시킬 정확한 토큰 샘플 (taskId/verdict 일치 필요)
- `approval-bad.txt` — 토큰 mismatch 샘플
