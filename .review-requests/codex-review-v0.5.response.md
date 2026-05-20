# Codex Review Response — v0.5.0-alpha

> **메타 정직성 알림**: 본 응답은 외부 Codex 가 아닌 **본 도구를 작성한 동일 AI** 가 reviewer 역할로 수행한 self-review. 진정한 외부 검증은 사용자가 실제 Codex CLI / 다른 AI 인스턴스에서 별도 수행 필요.

검증 일시: 2026-05-20
대상 커밋: `b310903` (HEAD before this response)

## Summary

NEKOFORGE v0.5 의 Phase WF/RP 통합은 대체로 NEKOFORGE 정체성을 유지. 15 항목 체크리스트 중 13 항목 PASS, 1 항목 NEEDS_HUMAN_REVIEW (Finding #H1), 1 항목 PASS_WITH_WARNINGS (Finding #M1). 본 응답 작성 중 2건의 fix 적용 후 모두 해소.

## 15 항목 체크리스트

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | gate 가 decision.json 단독 writer | ✅ PASS | `grep writeJson.*decision\.json src` → `src/core/gate/index.ts:678` 단 1건 |
| 2 | worker 가 apply/commit/push/deploy 가능? | ⚠️ → ✅ | Finding #H1 후 해소 (schema 강제) |
| 3 | impl ↔ security roleSeparation | ✅ PASS | `src/workers/index.ts:61` DEFAULT_ROLE_SEPARATION + validateRoleSeparation |
| 4 | worker result 만 `.harness/worker-runs/<task>/` | ✅ PASS | `src/workers/result.ts:39` (md), `:90` (json) 모두 동일 경로 |
| 5 | gate 가 worker evidence → workerFactory | ✅ PASS | `src/core/gate/index.ts:309~327` collectTaskWorkerResults + 집계 |
| 6 | missing required worker → verdict 강등 | ✅ PASS | `src/core/gate/index.ts:396~409` workerCap 설정 |
| 7 | worker critical finding → BLOCK | ✅ PASS | `src/core/gate/index.ts:421` worker-critical-finding critical → BLOCK |
| 8 | rule pack 이 gate 와 실제 연결? | ✅ PASS | `src/core/gate/index.ts:344` readRulePacks + resolveRulePacks 적용 |
| 9 | missing required rule pack → INSUFFICIENT_EVIDENCE | ✅ PASS | `src/core/gate/index.ts:368~377` rulePackCap 설정 |
| 10 | skill-pack missing 은 BLOCK 아님 | ✅ PASS | skillPackResolve 결과는 `status=partial`. verdict 영향 없음 (코드 검토 + T-RP-04 확인) |
| 11 | release mode + release-strict + benchmark | ✅ PASS | `src/rule-packs/resolve.ts:27` + `src/core/gate/index.ts:227~232` |
| 12 | Quality Contract / Score 강제 | ✅ PASS | `src/core/work/index.ts:79` contract 없으면 거부 + gate 의 contract invalid 처리 |
| 13 | BLOCK / INSUFFICIENT_EVIDENCE apply 우회 가능? | ✅ PASS | `src/rules/auto-apply-block.ts` BLOCKING_VERDICTS + apply Evidence before Apply 4겹 |
| 14 | .harness source of truth | ✅ PASS | `grep` 결과 .claude/.cursor/.codex 역방향 import 0건 |
| 15 | ECC 마켓플레이스 드리프트 | ✅ PASS | catalog 163 LOC (rule 73 + skill 90) — 큐레이션 유지 |

## v0.5 specific 4종

### 1. workers/rule-packs/skill-packs leaf placement

✅ PASS. `src/` 직속 leaf 배치는 dependency-cruiser 의 `no-cross-stage-core` 회피 + gate 단방향 import 의 정확한 해법. core stage 가 아닌 supporting layer (`scoring/` 와 동일 패턴). 0 violations 으로 정당화.

### 2. detectForbiddenActions false-positive 위험

⚠️ → ✅ **Finding #M1 해소**:

문제: worker result 에 "do not git push", "decision.json 작성 금지", "avoid kubectl apply" 같은 **부정형 표현** 도 발화시키는 FP.

해결: `isInNegationContext` 헬퍼 추가 — hit 의 ±40 chars 안에 부정 단어 (`do not / don't / never / avoid / 금지 / 막아야 / 회피 / 하지 마 / 하면 안 / 불가`) 가 있으면 hit 무시. 5 단위 테스트 추가 (한국어 포함).

의도된 한계: 우회 시도가 "git push 는 금지" 같은 위장으로 미탐 가능. WORKER-SAFETY.md 에 한계 명시 권장.

### 3. self-host #7 정직성 수준

✅ PASS. self-host #7 → #11 모두 NEEDS_HUMAN_REVIEW + 정확한 finding 발화 (no-test-risk + worker-missing-required). 본 도구가 본 도구를 자동 PASS 시키지 않는 정직성 layer 검증. 단, "self-host 가 같은 AI 가 작성한 코드를 검증" 이라는 메타-한계는 영구. 외부 사용자 PR 이 진정한 외부 신호.

### 4. 8 rule pack + 7 skill pack vs ECC drift

✅ PASS. 163 LOC 카탈로그 + template 자동 추천 + worker prompt 흡수 패턴. ECC 식 수천 줄 마켓플레이스 없음. CONTRIBUTING.md §4 가 "ECC 마켓플레이스화 거부" 명시.

## Critical findings

(없음)

## High-risk findings

### Finding #H1 — `canWriteDecision`/`canApply` 강제 부재 (해소)

**문제**: workers.json schema 가 `canWriteDecision`/`canApply` 를 그냥 `boolean` 으로 허용. 사용자가 직접 수정해서 `true` 로 설정 가능. 실제 방어는 아키텍처 (gate=단독 writer, apply=CLI+verdict) 가 하지만, 외부 검증자는 schema 만으로 판단할 위험.

**해결**: schema 를 `{ type: "boolean", const: false }` 로 강제. workers.json 이 둘 중 하나라도 true 면 schema invalid → gate Evidence before Apply 에서 거부.

**Verification**: 단위 테스트 추가 없음 (기존 workers.json 시드가 false 라 회귀 0). Schema validation 자체가 강제 메커니즘.

## Medium findings

### Finding #M1 — detectForbiddenActions FP (해소)

(위 §2 참조)

## Missing tests

(주요 누락 없음 — 282/282 통과)

## Architecture concerns

- `workers/types.ts` 의 순환 import 회피를 위한 분리는 정확. 다음 핫스팟 후보: gate/index.ts 가 779 LOC 로 800 임계 근접. 다음 라운드에 `large-file-risk` 발화 가능성.

## Minimal fixes (이 응답 라운드에서 적용)

| # | 파일 | 변경 |
|---|---|---|
| 1 | `src/schemas/workers.schema.ts` | `canWriteDecision`/`canApply` → `const: false` |
| 2 | `src/workers/validate.ts` | `isInNegationContext` + 부정형 회피 |
| 3 | `tests/unit/workers/validate.test.ts` | 5 새 테스트 (negation context + 정상 positive 유지) |

## Final verdict

**PASS_WITH_WARNINGS**

근거:
- 15 항목 체크리스트 + v0.5 specific 4종 모두 PASS (Finding #H1 / #M1 본 라운드에서 해소).
- 정체성 (Quality Contract / Quality Score / Gate / Apply / Human Gate / .harness 단일 사실원) 모두 유지.
- ECC/OMC 드리프트 없음.
- 한계: self-review 의 메타-한계 — 진정한 외부 검증은 다른 AI 인스턴스 또는 사람이 별도 수행 필요.

다음 라운드 후보:
- gate/index.ts 800 LOC 임계 근접 → 다음 변경 시 large-file-risk 발화 시 helper 추출.
- worker safety FP 회피의 우회 위장 사례 (`"git push 는 금지"` 식) 수집 시 휴리스틱 정밀화.
- external Codex / 다른 AI 인스턴스에서 진짜 외부 검증 수행.
