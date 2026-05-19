# Phase Rule Coverage — Beta 조건 #3 충족

> ROADMAP §10 Beta 진입 조건 중 **"모든 rule 의 발화 사례가 memory 에 최소 1건씩 적재"** 를 위해 누락 rule 의 eval-cases 일괄 추가.

## 적재 상태 (2026-05-19)

| 분류 | rule | eval-case 위치 |
|---|---|---|
| security | secret-fallback | phase-c-dogfood/eval-cases/secret-fallback-empty-fallback-useful.json |
| security | auth-bypass | phase-c-dogfood/eval-cases/auth-bypass-py-comment-useful.json |
| security | test-deletion | phase-c-dogfood/eval-cases/test-deletion-go-skip-useful.json |
| security | no-test-risk | phase-c-dogfood/eval-cases/no-test-risk-import-shuffle-fp.json |
| security | dangerous-file-write | phase-c-dogfood/eval-cases/dangerous-file-write-env-example-conservative.json |
| security | hook-injection-risk | phase-c-dogfood/eval-cases/hook-injection-postinstall-useful.json |
| security | agent-permission-risk | phase-c-dogfood/eval-cases/agent-permission-impl-and-security-useful.json |
| security | auto-apply-block | phase-c-dogfood/eval-cases/auto-apply-block-insufficient-useful.json |
| security | codex-missing-risk | phase-c-dogfood/eval-cases/codex-missing-adapter-zero-critical-useful.json |
| architecture | large-file-risk | **phase-rule-coverage/eval-cases/large-file-risk-useful.json** |
| architecture | layer-violation | **phase-rule-coverage/eval-cases/layer-violation-useful.json** |
| architecture | untyped-api-risk | **phase-rule-coverage/eval-cases/untyped-api-risk-useful.json** |
| architecture | circular-dependency-risk | **phase-rule-coverage/eval-cases/circular-dependency-risk-useful.json** |
| design | accessibility-risk | **phase-rule-coverage/eval-cases/accessibility-risk-useful.json** |
| design | design-token-violation | **phase-rule-coverage/eval-cases/design-token-violation-useful.json** |
| design | responsive-break-risk | **phase-rule-coverage/eval-cases/responsive-break-risk-useful.json** |
| gate finding | quality-contract-invalid | **phase-rule-coverage/eval-cases/quality-contract-invalid-useful.json** |

16 rule + 1 gate finding = 17개 모두 1건 이상 기록. Beta 조건 #3 충족.

## 다음 보강 영역

- `untyped-api-risk` / `circular-dependency-risk` 는 fixture 가 아직 없음 — 다음 self-host 회차에서 positive fixture 추가하면 휴리스틱 정밀도 측정 가능.
- `quality-contract-invalid` 도 fixture 추가 시 benchmark 통과 여부 측정 가능.
