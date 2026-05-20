# Example 08 — Rule Pack Missing → INSUFFICIENT_EVIDENCE

> Phase RP 의 required rule pack 부재 시 verdict 강등 흐름.

## 시나리오

backend-api template 의 quality contract 인데 `security-core` rule pack 이 disabled.

## 1. 초기화

```bash
$ harness contract --template backend-api --task TASK-001
$ harness rule-pack audit
[ok] rule-packs.json present. enabled: security-core, test-discipline, architecture-core, quality-contract-core, worker-safety-core
```

## 2. 의도적으로 security-core 비활성

```bash
$ harness rule-pack disable security-core
[ok] disabled. now: test-discipline, architecture-core, quality-contract-core, worker-safety-core

$ harness rule-pack status
configured: true
enabled: test-discipline, architecture-core, quality-contract-core, worker-safety-core
disabled: security-core
template requirements:
  web-ui: security-core, design-web, test-discipline, quality-contract-core
  backend-api: security-core, architecture-core, test-discipline, release-strict, quality-contract-core
  ...
```

## 3. Gate 실행

```bash
$ harness gate --task TASK-001
[verdict] INSUFFICIENT_EVIDENCE
[rules] rule-pack-missing
```

decision.json.rulePacks:

```json
{
  "status": "missing",
  "enabled": ["test-discipline", "architecture-core", "quality-contract-core", "worker-safety-core"],
  "required": ["security-core", "architecture-core", "test-discipline", "release-strict", "quality-contract-core"],
  "missingRequired": ["security-core", "release-strict"],
  "triggeredPacks": []
}
```

## 4. Apply 차단

```bash
$ harness apply --approved
[refuse] verdict=INSUFFICIENT_EVIDENCE; cannot apply
# exit code 4
```

## 5. 해결

```bash
$ harness rule-pack enable security-core
$ harness rule-pack enable release-strict
$ harness gate --task TASK-001
[verdict] PASS_WITH_WARNINGS
```

## 6. 의도

- backend-api 프로젝트에서 security-core 가 빠진 상태로 출고되는 것을 방지.
- web-ui 의 경우 design-web 만 누락 시 NEEDS_HUMAN_REVIEW (덜 엄격) — 예제 09 참조.
