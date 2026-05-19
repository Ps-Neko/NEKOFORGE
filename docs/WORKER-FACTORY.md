# WORKER FACTORY — NEKOFORGE Phase WF

> Phase WF (Worker Factory Upgrade) — Quality Contract 위에 **통제된 작업자 계층** 을 추가한다.
> Worker 는 evidence 를 만들 뿐, 결재자가 아니다.

## 1. 정체성

NEKOFORGE 의 worker layer 는 OMC 식 무인 작업반이 아니다. **prompt 생성 + result import + gate 입력** 이 1차 MVP 의 책임이다. 자동 LLM 실행은 Phase WF-2 이후.

```text
worker 책임:
- 자신의 역할 prompt 를 받아 결과를 만든다.
- 결과는 .harness/worker-runs/<task>/<worker>.result.{md,json} 에 evidence 로 남는다.
- worker 가 직접 decision.json 을 작성하지 않는다.
- worker 가 직접 apply/commit/push/deploy 하지 않는다.
```

## 2. Worker 역할 8종

| Worker | 책임 | decision 작성 | apply |
|---|---|:-:|:-:|
| `product-questioner` | 제품 질문, 사용자/문제/가치 정리 | ✗ | ✗ |
| `architect` | 구조 설계, 경계, 모듈 계획 | ✗ | ✗ |
| `implementation-worker` | 실제 구현안 작성/수정안 생성 | ✗ | ✗ |
| `test-worker` | 테스트 계획/코드/검증 결과 | ✗ | ✗ |
| `refactor-worker` | 구조 개선, 중복 제거, 단순화 | ✗ | ✗ |
| `security-reviewer` | 보안 위험 검토 | ✗ | ✗ |
| `design-reviewer` | UI/UX/accessibility/design token | ✗ | ✗ |
| `release-gatekeeper` | release readiness 검토, gate 전 점검 | ✗ | ✗ |

## 3. 강제 규칙

```text
implementation-worker 와 security-reviewer 동일 ID 금지
implementation-worker 와 release-gatekeeper 동일 ID 금지
test-worker 와 implementation-worker 겸직은 safe/release mode 에서 금지
design-reviewer 는 uiTouched=true 일 때 required
release-gatekeeper 는 gate input 검토 가능, decision.json 작성 불가
모든 worker 는 forbiddenActionsDeclared 에 no-commit/no-push/no-deploy/no-apply 명시
```

## 4. CLI

```bash
harness workers init --profile minimal|standard|strict
harness workers list
harness workers status
harness workers validate

harness dispatch <task-id> --worker <role>
harness dispatch <task-id> --all --mode producer-reviewer

harness worker-result import <task-id> --worker <role> --file result.md
harness worker-result list <task-id>
harness worker-result show <task-id> --worker <role>
```

## 5. Artifact 구조

```text
.harness/
  workers.json
  worker-policy.json
  worker-routing.json
  worker-handoff.md
  worker-runs/
    <task-id>/
      <worker>.prompt.md
      <worker>.result.md
      <worker>.result.json
```

## 6. Worker profile

| Profile | required workers |
|---|---|
| `minimal` | implementation-worker |
| `standard` | implementation-worker + test-worker + security-reviewer |
| `strict` | standard + architect + design-reviewer + release-gatekeeper |

## 7. workers.json 형식

```json
{
  "schemaVersion": "0.5",
  "profile": "standard",
  "workers": [
    {
      "id": "impl-1",
      "role": "implementation-worker",
      "allowedStages": ["work"],
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

## 8. worker-result 형식

```json
{
  "schemaVersion": "0.5",
  "taskId": "TASK-001",
  "workerId": "security-reviewer",
  "role": "security-reviewer",
  "status": "completed",
  "summary": "no critical findings",
  "findings": [
    {
      "severity": "warning",
      "title": "missing rate limit",
      "detail": "auth endpoint has no rate limit",
      "file": "src/auth/login.ts",
      "line": 42
    }
  ],
  "evidence": {
    "prompt": ".harness/worker-runs/TASK-001/security-reviewer.prompt.md",
    "result": ".harness/worker-runs/TASK-001/security-reviewer.result.md"
  },
  "forbiddenActionsDeclared": ["no-commit", "no-push", "no-deploy", "no-apply"]
}
```

## 9. Gate 통합

`decision.json.workerFactory`:

```json
{
  "workerFactory": {
    "status": "complete | partial | missing | violated",
    "profile": "standard",
    "requiredWorkers": ["implementation-worker", "test-worker", "security-reviewer"],
    "completedWorkers": ["implementation-worker", "security-reviewer"],
    "missingWorkers": ["test-worker"],
    "roleSeparationViolations": [],
    "workerFindingsCount": 3,
    "criticalWorkerFindings": 0
  }
}
```

Verdict 영향:

```text
required worker result 누락                 → NEEDS_HUMAN_REVIEW
release mode + security-reviewer 누락        → INSUFFICIENT_EVIDENCE
role separation 위반                         → NEEDS_HUMAN_REVIEW
worker critical finding                      → BLOCK
worker high finding                          → NEEDS_HUMAN_REVIEW
worker 가 decision.json 직접 작성 시도        → BLOCK (worker-safety rule)
worker 가 commit/push/deploy/apply 시도       → BLOCK (worker-safety rule)
```

## 10. 본 문서가 답하지 않는 것

- worker prompt 의 구체 템플릿 → `src/core/workers/dispatch.ts`
- worker safety rule 휴리스틱 → SECURITY.md §3.14
- rule pack 정의 → docs/RULE-PACKS.md
- skill pack 정의 → docs/SKILL-PACKS.md
