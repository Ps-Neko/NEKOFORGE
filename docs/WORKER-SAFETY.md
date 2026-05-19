# WORKER SAFETY — Phase WF 안전 약속

> Worker layer 가 추가되면서 "worker 가 결재자가 되지 않는다" 는 약속을 명시적으로 강제한다.

## 1. 절대 금지 (worker)

```text
1. worker 가 decision.json 을 직접 작성하거나 수정.
2. worker 가 commit / push / deploy / apply 실행.
3. worker 가 .harness/audit.jsonl 수정.
4. worker 가 quality-contract.json 의 quality bars 약화.
5. worker 가 다른 worker 의 result 덮어쓰기.
6. worker 가 self-assign 으로 role separation 위반 (impl+sec, impl+release).
```

## 2. 방어 메커니즘

| 침해 | 차단 위치 |
|---|---|
| worker → decision.json | gate 단독 작성. worker-runs 디렉터리만 worker write 가능 |
| worker → apply | apply 는 별도 CLI + Human Gate token 필수 |
| worker → audit chain | hook-injection-risk + audit anchor 검증 |
| worker → quality bars | contract 의 qualityBars 는 contract 단계에서만 작성, 이후 schema 검증 |
| role 겸직 | workers.json 의 roleSeparation + workers validate |
| worker safety rule | gate 가 worker-runs 에서 forbidden action 패턴 검출 시 BLOCK |

## 3. worker-safety rule 휴리스틱

`src/rules/worker-safety-risk.ts` 가 다음 패턴 발견 시 critical 발화:

```text
- worker result 안에 "decision.json" 문자열 (write 시도 표현)
- worker result 안에 "git commit", "git push", "deploy", "kubectl apply" 표현
- worker result 의 evidence.result 경로가 .harness/worker-runs/ 외부
- workers.json 의 roleSeparation 위반 (validator)
- worker prompt 안에 "ignore the quality contract" 류 우회 지시
```

## 4. release mode 추가 강제

```text
release mode + security-reviewer result missing → INSUFFICIENT_EVIDENCE
release mode + design-reviewer required (uiTouched) missing → INSUFFICIENT_EVIDENCE
release mode + release-gatekeeper result missing → NEEDS_HUMAN_REVIEW
release mode + worker high finding → NEEDS_HUMAN_REVIEW
release mode + worker critical finding → BLOCK
```

## 5. backward compat

기존 .harness (workers.json 없는 워크스페이스):

```text
fast mode    → workerFactory.status="missing" + warning, verdict 영향 없음
safe mode    → workerFactory.status="missing" + NEEDS_HUMAN_REVIEW
release mode → workerFactory.status="missing" + INSUFFICIENT_EVIDENCE
```

`harness workers init` 으로 마이그레이션. profile 미지정 시 standard.

## 6. 본 문서가 답하지 않는 것

- worker role 정의 → docs/WORKER-FACTORY.md
- worker prompt 템플릿 → `src/core/workers/dispatch.ts`
- rule pack 정의 → docs/RULE-PACKS.md
