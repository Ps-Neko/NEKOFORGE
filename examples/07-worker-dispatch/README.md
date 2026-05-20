# Example 07 — Worker Dispatch

> Phase WF 의 worker prompt 생성 → result import → gate 통합 흐름.

## 시나리오

PR 에 대해 standard profile (impl + test + sec) 3 worker 를 dispatch.

## 1. 초기화

```bash
$ harness workers init --profile standard
[ok] workers.json (profile=standard) saved at .harness/workers.json
[next] harness dispatch <task-id> --worker implementation-worker
```

생성된 workers.json (요약):

```json
{
  "schemaVersion": "0.5",
  "profile": "standard",
  "workers": [
    { "id": "implementation-1", "role": "implementation-worker", ... },
    { "id": "test-1", "role": "test-worker", ... },
    { "id": "security-1", "role": "security-reviewer", ... }
  ],
  "roleSeparation": [
    ["implementation-worker", "security-reviewer"],
    ["implementation-worker", "release-gatekeeper"]
  ]
}
```

## 2. Dispatch (prompt 생성)

```bash
$ harness dispatch TASK-001 --worker implementation-worker
[ok] prompt saved: .harness/worker-runs/TASK-001/implementation-worker.prompt.md
[next] 결과 작성 후 `harness worker-result import TASK-001 --worker implementation-worker --file <result.md>`

$ harness dispatch TASK-001 --worker test-worker
$ harness dispatch TASK-001 --worker security-reviewer
```

3 worker 의 prompt 가 `.harness/worker-runs/TASK-001/` 에 생성됨.

## 3. Result import (사용자가 prompt → Claude/Codex 에 입력 → 결과 저장)

```bash
$ cat > impl-result.md <<EOF
# implementation-worker result

요약: src/auth/login.ts 의 rate limit middleware 추가.
- src/auth/login.ts: 5 req/min limit
- 테스트는 test-worker 가 별도 담당.
EOF

$ harness worker-result import TASK-001 --worker implementation-worker --file impl-result.md
[ok] result.md: .harness/worker-runs/TASK-001/implementation-worker.result.md
[ok] result.json: .harness/worker-runs/TASK-001/implementation-worker.result.json
```

worker-result.json 은 worker-safety 자동 검사 후 저장:
- body 안에 `git push`, `decision.json`, `harness apply` 등 forbidden action 패턴이 있으면 critical finding 자동 추가.

## 4. Gate 통합

```bash
$ harness gate
[verdict] PASS_WITH_WARNINGS
```

decision.json.workerFactory:

```json
{
  "status": "complete",
  "profile": "standard",
  "requiredWorkers": ["implementation-worker", "test-worker", "security-reviewer"],
  "completedWorkers": ["implementation-worker", "test-worker", "security-reviewer"],
  "missingWorkers": [],
  "roleSeparationViolations": [],
  "workerFindingsCount": 0,
  "criticalWorkerFindings": 0
}
```

## 5. 누락 시 동작

- security-reviewer result 누락 + release mode → INSUFFICIENT_EVIDENCE (예제 10 참조)
- worker result 안에 `git commit` 표현 → worker-safety-risk critical → BLOCK

## 6. 본 예제가 답하지 않는 것

- rule-pack 시드 → examples/08
- skill-pack 시드 → examples/09
- role 위반 시나리오 → examples/10
- worker 자동 LLM 실행 → Phase WF-2 (미예약)
