# RULE PACKS — Phase RP

> 16개 deterministic rule 을 ECC 식 풍부함이 아닌 **NEKOFORGE 식 큐레이션** 으로 8개 pack 으로 묶는다.

## 1. 정체성

```text
pack = rule 그룹 + quality-contract template 추천 연결
rule pack 은 verdict 영향 가능
rule pack 은 silent 하게 quality bar 약화 불가 (gate 가 missingRequired 검사)
```

## 2. Rule Pack 8종

| Pack | 포함 rule | 목적 |
|---|---|---|
| `security-core` | secret-fallback, auth-bypass, dangerous-file-write, hook-injection-risk, agent-permission-risk | 보안 최소선 |
| `test-discipline` | test-deletion, no-test-risk | 테스트 품질 |
| `architecture-core` | large-file-risk, layer-violation, circular-dependency-risk, untyped-api-risk | 구조 품질 |
| `design-web` | accessibility-risk, design-token-violation, responsive-break-risk | UI/UX 품질 |
| `release-strict` | codex-missing-risk, auto-apply-block, release-benchmark-required | 출고 엄격 모드 |
| `ai-generated-code-risk` | no-test-risk, untyped-api-risk, secret-fallback, auth-bypass | AI 산출물 위험 대응 |
| `worker-safety-core` | worker-safety-risk + agent-permission-risk | worker 통제 |
| `quality-contract-core` | (gate finding) quality-contract-invalid, quality-score-required, failed-required-bars | 계약/점수 강제 |

## 3. CLI

```bash
harness rule-pack list
harness rule-pack enable <pack>
harness rule-pack disable <pack>
harness rule-pack status
harness rule-pack audit
```

## 4. Template 자동 추천 (rule-packs.json)

```json
{
  "schemaVersion": "0.5",
  "enabledPacks": ["security-core", "test-discipline", "architecture-core", "quality-contract-core"],
  "disabledPacks": [],
  "requiredForTemplates": {
    "web-ui": ["security-core", "design-web", "test-discipline", "quality-contract-core"],
    "backend-api": ["security-core", "architecture-core", "test-discipline", "release-strict"],
    "cli-tool": ["security-core", "test-discipline", "architecture-core"],
    "library": ["architecture-core", "test-discipline", "release-strict"]
  }
}
```

## 5. Gate 통합

```json
{
  "rulePacks": {
    "status": "complete | missing | violated",
    "enabled": ["security-core", "architecture-core"],
    "required": ["security-core", "test-discipline"],
    "missingRequired": [],
    "triggeredPacks": ["security-core"]
  }
}
```

Verdict 영향:

```text
required rule pack missing                    → INSUFFICIENT_EVIDENCE
release mode + release-strict disabled         → INSUFFICIENT_EVIDENCE
web-ui template + design-web disabled         → NEEDS_HUMAN_REVIEW
backend-api template + security-core disabled  → BLOCK
```

## 6. 본 문서가 답하지 않는 것

- 개별 rule 동작 → SECURITY.md §3
- skill pack 정의 → docs/SKILL-PACKS.md
