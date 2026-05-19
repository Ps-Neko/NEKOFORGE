# Example 02 — Blocked by secret-fallback

> TASKS.md D-002 — secret-fallback 발화 시나리오.

## 시나리오

`harness work TASK-001` 직후 가져온 diff 가 다음을 포함한다.

```diff
diff --git a/src/config.ts b/src/config.ts
@@ -1 +1 @@
-const x = 1;
+const KEY = process.env.API_KEY || "sk-test-fallback-12345";
```

## 흐름

```text
harness review       → codex stub passed
harness gate         → verdict = BLOCK
                       triggered: secret-fallback (critical)
                       REPORT.md / decision.json 생성
harness apply --approved → exit 4 (AutoApplyBlockedError)
```

## decision.json 발췌

```json
{
  "verdict": "BLOCK",
  "riskLevel": "critical",
  "humanApprovalRequired": true,
  "humanApproved": false,
  "deterministicRules": {
    "status": "failed",
    "triggeredRules": ["secret-fallback"]
  },
  "apply": {
    "allowed": false,
    "reason": "apply requires Human Gate or is blocked"
  }
}
```

## 재현

본 디렉터리의 `last-diff.patch` 를 `.harness/last-diff.patch` 로 복사하고,
seedHarness 의 정상 흐름 후 `harness gate` 실행하면 위 verdict 가 재현된다.
T-SEC-01 의 e2e 가 동일한 시나리오를 자동 검증한다.
