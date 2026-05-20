# Example 10 — Worker Role Violation

> Phase WF 의 role separation 강제 — 한 worker.id 가 분리되어야 할 두 역할을 모두 가지면 위반.

## 시나리오

비용 절약 목적으로 같은 worker 가 implementation + security 두 역할을 동시에 수행하려는 경우. 본 도구가 차단.

## 1. workers.json 직접 편집 (잘못된 예)

```json
{
  "schemaVersion": "0.5",
  "profile": "standard",
  "workers": [
    {
      "id": "dual-1",
      "role": "implementation-worker",
      "canWriteDecision": false,
      "canApply": false,
      "forbiddenActionsDeclared": ["no-commit", "no-push", "no-deploy", "no-apply"]
    },
    {
      "id": "dual-1",
      "role": "security-reviewer",
      "canWriteDecision": false,
      "canApply": false,
      "forbiddenActionsDeclared": ["no-commit", "no-push", "no-deploy", "no-apply"]
    }
  ],
  "roleSeparation": [
    ["implementation-worker", "security-reviewer"],
    ["implementation-worker", "release-gatekeeper"]
  ]
}
```

`dual-1` 한 ID 가 두 역할 보유.

## 2. Validate

```bash
$ harness workers validate
[error] role separation violation:
  - dual-1 holds both implementation-worker and security-reviewer
# exit code 10
```

## 3. Status

```bash
$ harness workers status
configured: true
profile: standard
workers: 2
roles: implementation-worker, security-reviewer
roleSeparation: dual-1 holds both implementation-worker and security-reviewer
```

## 4. Gate (worker result 시드 후)

```bash
$ harness dispatch TASK-001 --worker implementation-worker
$ harness worker-result import TASK-001 --worker implementation-worker --file r.md
$ harness dispatch TASK-001 --worker security-reviewer
$ harness worker-result import TASK-001 --worker security-reviewer --file r.md

$ harness gate --task TASK-001
[verdict] NEEDS_HUMAN_REVIEW
[rules] worker-role-separation
```

decision.json.workerFactory.roleSeparationViolations:

```json
[
  "dual-1 holds both implementation-worker and security-reviewer"
]
```

## 5. 해결

```json
{
  "workers": [
    { "id": "impl-1", "role": "implementation-worker", ... },
    { "id": "sec-1", "role": "security-reviewer", ... }
  ]
}
```

## 6. 의도

- 한 AI/사람 ID 가 구현 + 보안 검토를 동시에 하면 보안 검토의 독립성이 사라짐.
- 같은 ID 가 implementation + release-gatekeeper 도 금지 (출고 결정의 독립성).
- 본 강제는 OMC/ECC 가 모방할 수 없는 NEKOFORGE 의 정체성 강제.
