# Example 06 — Quality Contract Failure

> Phase QF — QF-015 의 예제. `quality-contract.json` 부재 또는 required quality bar 미달 시 어떻게 차단되는지.

## 시나리오 A — contract 누락

```text
$ harness work TASK-001
[error] quality-contract.json missing (run `harness contract`)
[exit] 10
```

`work` 진입이 거부됨. SECURITY.md §3.10 의 audit-integrity 와 같은 등급의 강제력.

## 시나리오 B — required bar 미달

`quality-contract.json` 에 `qualityBars.security = { minimum: 95, required: true }` 로 설정.
그러나 deterministic finding 으로 security 점수가 60 까지 떨어짐.

```text
$ harness gate
[verdict] NEEDS_HUMAN_REVIEW
[rules]   secret-fallback
[reason]  required quality bar failed: security (60 < 95)
$ harness apply --approved
[refuse] verdict=NEEDS_HUMAN_REVIEW
[hint]   .harness/approval.txt 의 토큰 필요
```

## 의미

- `work` 전 강제 (Quality Contract before Work).
- `gate` 단계에서 required bar 미달이 verdict 상한을 잡음 (PASS 불가).
- 본 도구의 정체성: 단순 차단(BLOCK) 외에 **품질 압력** 추가.
