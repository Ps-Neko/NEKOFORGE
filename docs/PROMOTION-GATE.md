# PROMOTION-GATE — 룰/스킬/경험 승격 게이트 (v0.1 — rule 승격 P1a/P1b 구현 완료 · experience/skill-pack 은 설계)

> 버전 0.1 · 2026-05-26 · 본 문서는 "검사 규칙·작업 지침·현장 경험을 NEKOFORGE 카탈로그에 **들이기 전에**, 과거 사례로 시험해 **성능이 개선됐을 때만 채용**하는" 승격 게이트(promotion gate)의 1차 설계 명세다. SkillOpt(검증 점수가 오를 때만 수락) · From Raw Experience(자동 생성물의 "좋아 보임"은 못 믿는다) · SkillEvolBench(경험 ≠ 재사용 가능한 절차) 의 통찰을 NEKOFORGE 정체성으로 흡수한다.
>
> 출처: 본 설계는 harness(=NEKOWORK) 레포의 forge-engine 복제 docs(2026-05 "중복 헤비 엔진 제거"로 삭제됨)에서 헤비 단일 소스인 NEKOFORGE 로 이전됐다. 실측 대상 코드: `src/benchmark/index.ts` · `src/rules/index.ts` · `src/utils/integrity.ts` · `src/schemas/decision.schema.ts`. 본 문서는 PRODUCT.md 를 상위 근거로 삼으며 BENCHMARKS.md / RULE-PACKS.md / SKILL-PACKS.md / QUALITY-SCORE.md 와 정합해야 한다.

## 0. 한 줄 정의

```text
Promotion Gate =
새 rule / skill-pack / 경험-유래 rule 후보를
fixture 기반 시험에 태워,
"놓침(criticalRecall)이 줄고 AND 헛경보(falsePositiveRate)가 늘지 않은"
경우에만 사람 승인을 거쳐 카탈로그에 채용하는,
NEKOFORGE 자신을 진화시키는 메타 게이트.
```

## 1. 왜 필요한가 — 빈틈 (실측)

현재 NEKOFORGE 의 `src/benchmark/index.ts` 는 `runBenchmark(fixturesRoot, filterGroup?)` 로 **현재 룰셋 전체의 정확도**(`criticalRecall` · `falsePositiveRate`)를 측정한다. 그러나:

```text
실측: runScenario() 가 [...ALL_RULES, ...ALL_ARCHITECTURE_RULES, ...] 를
      모듈 import 로 고정 사용한다 (rules/index.ts).
한계: "후보 rule 을 넣은 룰셋" 과 "뺀 룰셋" 을 비교 실행할 입구가 없다.
없음: 새 rule 추가 전에 "이 추가가 성능을 올리는가?" 를 강제하는 관문.
```

즉 헛경보만 늘리는 rule, 기존 rule 의 시험을 망치는 rule(cross-rule interference), "좋아 보이지만 실제로는 성능을 떨어뜨리는" 자동 생성물이 **검증 없이 카탈로그에 들어올 수 있다**. 이 문서는 그 관문을 정의한다.

근거 자료:

| 자료 | 핵심 주장 | 본 게이트에의 반영 |
|---|---|---|
| SkillOpt | skill 을 add/delete/replace 로 편집하되, 검증 점수가 오를 때만 수락 | 승격 = "before < after" 가 성립할 때만 |
| From Raw Experience | 자동 생성 스킬 일부는 성능을 떨어뜨리고, LLM judge 의 "좋아 보임" 은 신뢰 불가 | 승격 판정에 LLM 투표 금지. deterministic 지표만 |
| SkillEvolBench | 경험을 쌓는 것과 재사용 가능한 절차형 스킬을 만드는 것은 다르다 | 경험은 곧장 rule 이 되지 않고 fixture → 후보 → 시험을 거침 |

## 2. 정체성

```text
Promotion Gate 는 benchmark 가 아니다 (benchmark 는 점수를 매기는 시험기).
Promotion Gate 는 rule 실행기가 아니다 (그건 gate 단계).
Promotion Gate 는 14단계 공정의 일부가 아니다 (그건 코드 변경을 검증).

Promotion Gate 는 "카탈로그(rule/skill-pack)에 무엇을 들일지" 를
시험 + 사람 승인으로 통제하는 별도 책임자(=인사과)다.
```

정체성은 다음 결정에서 드러난다.

- **측정과 채용 결정의 분리.** `benchmark` 는 점수만 매긴다. 채용 여부 · 탈락 보관 · 이력은 본 게이트가 전담한다(PRODUCT §2 "단계가 다른 단계를 대신할 수 없다" 의 연장).
- **채용 도장은 사람.** 시험 · 비교 · 합격 판정은 자동이지만, 카탈로그 편입은 Human Gate 를 거친다(PRODUCT §3.3, §7.4).
- **승격 판정도 LLM 투표 없이 deterministic.** "더 좋아 보인다" 가 아니라 "지표가 개선됐다" 만 인정(NEKOFORGE 해자 = 속일 수 없는 verdict).
- **모든 승격은 사람이 읽는 `.md` + 기계가 읽는 `.json` 으로 동시에 남는다**(PRODUCT §7.3).

## 3. 범위 — 세 대상, 단계적 도입

| 대상 | 무엇을 채용하나 | 시험 채점 방식 | 난이도 | Phase |
|---|---|---|---|---|
| **① deterministic rule** | `src/rules/*.ts` 신규/수정 rule | benchmark 의 criticalRecall · falsePositiveRate (before/after) | 쉬움(토대 있음) | **P1** |
| **② 경험 → rule** | memory 의 미탐/오탐 사례에서 유도한 rule 후보 | 경험 사례를 fixture 로 변환 → ① 의 채점 재사용 | 중간 | **P2 ✅구현**(fixture=promote 제출, eval-case=`--experience` provenance) |
| **③ skill-pack** | `docs/SKILL-PACKS.md` 의 worker 행동 지침 | 직접 점수화 곤란 → 간접 신호 + 사람 검토 | 어려움 | **P3(후속)** |

세 대상은 **동일한 승격 관문**(제출 → 시험 → before/after 비교 → 합격 판정 → 사람 승인 → 채용/탈락)을 공유한다. 대상마다 다른 것은 "채점표(adapter)" 뿐이다. 따라서 공통 엔진 1개 + 대상별 adapter N개 구조로 짓는다.

**③ skill-pack 의 단서**: skill-pack 은 verdict 를 직접 만들지 않으므로(SKILL-PACKS.md §1) criticalRecall 로 점수를 매길 수 없다. 무리한 자동 점수화는 From Raw Experience 의 경고("좋아 보임"의 함정)에 정면으로 걸린다. 그러므로 P3 는 **간접 신호**(해당 지침이 권하는 행동이 관련 rule 발화를 줄였는가)와 **사람 검토**로만 다루며, P1/P2 가 안정화된 뒤 착수한다.

## 4. 전체 흐름

```text
            새 후보 제출 (rule | 경험 | skill-pack)
                        │
                        ▼
            ┌──────── Promotion Gate ────────┐
            │ benchmark 를 동일 fixture 로 2회 │
            │  ├ baseline (현 카탈로그)  → 점수 A │
            │  └ candidate (현 + 후보)  → 점수 B │
            └───────────────┬────────────────┘
                            ▼
        합격 판정 (엄격): B.recall ≥ A.recall  AND  B.fpRate ≤ A.fpRate
        (전체 룰셋 기준. 둘 중 하나라도 악화 시 불합격)
                  │                              │
              불합격                          합격
                  ▼                              ▼
        ❌ rejected/<id>.json          📋 REPORT.md + decision.json
          (사유 · 점수차 기록)            (promoteVerdict = PROMOTE_READY)
                                                 │
                                       nekoforge promote approve --approved
                                                 │  (사람 승인 = Human Gate)
                                    ┌────────────┴────────────┐
                                  거절                       승인
                                    ▼                         ▼
                          ❌ rejected/<id>.json     ✅ 카탈로그 편입 + ledger.jsonl 기록
```

`promoteVerdict` 값(decision.schema.ts 의 verdict 어휘를 본 게이트용으로 재사용):

| verdict | 의미 |
|---|---|
| `PROMOTE_READY` | 지표 개선 + 증거 충분. 사람 승인 대기 |
| `REJECTED` | 지표 악화 또는 사람 거절. rejected 보관 |
| `INSUFFICIENT_EVIDENCE` | fixture 부족/누락. 시험 자체가 불가 |
| `NEEDS_HUMAN_REVIEW` | 지표는 동률이거나 경계값. 사람 판단 필요 |

## 5. 합격 기준 (엄격)

```text
승격 합격 ⇔  criticalRecall(after) ≥ criticalRecall(before)
        AND  falsePositiveRate(after) ≤ falsePositiveRate(before)
        AND  둘 중 최소 하나는 strict 개선 (동률만으로는 PROMOTE_READY 아님 → NEEDS_HUMAN_REVIEW)
```

- **전체 룰셋 기준.** 후보 rule 단독 성능이 아니라 "후보를 포함한 카탈로그 전체"의 점수로 비교한다. 이는 cross-rule interference(BENCHMARKS.md)를 승격 판정에 정직하게 반영하기 위함이다.
- **보수적 채택.** 동률(개선 없음)은 자동 합격이 아니라 `NEEDS_HUMAN_REVIEW`. QUALITY-SCORE.md §2 의 "더 보수적인 것 채택" 사상과 일치.
- **가중치 변경 금지(MVP).** "헛경보가 늘어도 놓침이 더 줄면 OK" 식 가중 합산은 본 설계에서 채택하지 않는다(사용자 결정: 엄격).

## 6. 자동화 수준

| 행위 | 주체 | 근거 |
|---|---|---|
| baseline/candidate 시험 실행 | 자동 | benchmark 재사용 |
| before/after 비교 · 합격 판정 | 자동 (deterministic) | LLM 투표 금지 |
| 카탈로그 편입(채용) | **사람 승인** | PRODUCT §3.3 위험 작업 = 명시 승인 |
| 탈락 보관 · 이력 기록 | 자동 | 단 ledger 는 append-only |

`PROMOTE_READY` 상태에서도 `nekoforge promote approve --approved` 없이는 카탈로그가 바뀌지 않는다. `harness apply --approved`(코드 변경)와 동일한 Human Gate 패턴을 카탈로그 변경에 적용한 것이다.

## 7. 저장 구조

NEKOFORGE 관례(`.harness/` 하위, 사람용 `.md` + 기계용 `.json`)를 따른다.

P1b 구현 기준(rule 대상):

```text
.harness/promotions/
  <id>/
    candidate.json     — 후보 정의 { id, kind:"rule", modulePath, exportName, submittedAt }
    fixtures-hash.json — { fixturesHash } — 제출 시 --fixtures 묶음(후보+expected/patch)의 canonicalHash 봉인(§8-1)
    trial.json         — { baseline, candidate, verdict, reasons, fixturesHash, ranAt }
    REPORT.md          — 사람용 채용 보고서 (점수차 + 판정 + 사유)
    decision.json      — { verdict: "approved"|"rejected", approvedBy?, approvalHash?, reason?, decidedAt }
  promoted.json        — 채용된 rule 매니페스트 { rules: [{ id, modulePath, exportName, promotedAt, approvalHash }] }
                         loadActiveRules/gate/benchmark 가 동적 로딩(B안: approve 시 자동 갱신)
  ledger.jsonl         — submit/trial/approve/reject 이력 (append-only chain; verifyLedgerChain 으로 위변조 탐지)
```

> 거절도 `<id>/decision.json`(verdict:"rejected") + ledger 로 기록한다(별도 `rejected/` 디렉토리 미사용). 후보 fixtures 자체는 `--fixtures` 디렉토리에서 읽어 해시만 봉인하며, 아티팩트로 복사하지 않는다.

## 8. 못 속이게 하는 4가지 잠금

NEKOFORGE 해자(content-hash 결박 · audit chain/anchor)를 본 게이트에 그대로 적용한다. 해시는 `src/utils/integrity.ts` 의 **`canonicalHash(value)`**(키 정렬 sha256, decision 무결성에 이미 쓰는 함수)를 재사용한다.

1. **시험 입력 봉인.** `trial.json.fixturesHash = canonicalHash(후보 정의 + fixture 묶음)`. → "다른 fixture 로 몰래 시험하고 통과한 척" 차단.
2. **동일 조건 강제.** 점수 A 와 B 는 동일 fixture 세트로만 계산. fixturesHash 불일치 시 trial 무효. **(구현)** `promote trial` 이 trial 시점 fixtures 를 재해싱(`verifyFixturesHash`)해 submit 봉인값과 대조, 불일치 시 `INVALID_TRIAL`(exit 4) 거부.
3. **승인 봉인.** `decision.json.approvalHash = canonicalHash(승인 시점의 trial.json)`. → "다른 결과를 보고 승인한 척" 차단(audit-integrity 사상).
4. **이력 append-only.** `ledger.jsonl` 은 덧붙이기 전용. 직전 라인 해시를 다음 라인이 참조(chain) + anchor(`ledger-anchor.json`). **(구현)** 매 append 전 `verifyLedgerChain`(chain) + `verifyLedgerAnchor`(라인 삭제·firstHash 변경·전체 재작성 탐지) 검증, 위반 시 `LEDGER_TAMPERED`(exit 5) 차단. → 채용 이력 사후 위조 탐지(`extractLastDecisionHash` 류 chain 인프라 준용).

## 9. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 후보가 fixture 를 안 가져옴 | `INSUFFICIENT_EVIDENCE` 로 거부 (증거 없으면 통과 없음, PRODUCT §7) |
| fixture 가 너무 적음 | 최소 기준 미달 시 거부. 권장 최소: 해당 rule positive ≥ 3 + negative ≥ 2 |
| 후보 rule 이 다른 rule 시험을 망침 | 전체 룰셋 점수로 비교하므로 fpRate 악화로 자동 불합격 |
| baseline 과 candidate 점수가 완전 동일 | `NEEDS_HUMAN_REVIEW` (개선 없음 = 자동 채용 아님) |
| 같은 후보 재제출 | candidate.json 해시로 중복 감지. 기존 rejected 사유 표면화 |
| fixture 자체가 cross-rule 오염 | 작성 후 즉시 trial 로 회수(BENCHMARKS.md 회피 패턴 준용) |

## 10. CLI (P1b 구현됨)

`nekoforge promote`(= `harness promote`) 단일 명령군(서브커맨드)으로 추가됨. 최상위 명령은 1개만 늘어난다. 등록은 기존 `registerXxx(program)` 패턴(`src/cli/commands/promote.ts`)을 따른다. P1b 는 `kind:"rule"` 만 지원한다.

```bash
nekoforge promote submit <id> --module <path> --export <name> --fixtures <dir>
                                          # 후보 제출(candidate.json + fixturesHash 봉인). fixtures 최소기준 미달 시 INSUFFICIENT_EVIDENCE(exit 4)
nekoforge promote trial <id> --fixtures <dir>
                                          # baseline(현 채용분 포함) vs candidate 시험 → trial.json
nekoforge promote report <id>             # REPORT.md 출력 (사람 검토용)
nekoforge promote approve <id> --approved [--by <who>]
                                          # 사람 승인 → promoted.json 채용 + ledger. PROMOTE_READY 만 허용(아니면 exit 3)
nekoforge promote reject <id> [--reason <text>]  # 명시 거절 → decision.json(rejected) + ledger
nekoforge promote list                    # 채용된 rule 목록(promoted.json)
```

본 명령군은 14단계 공정과 독립적으로 동작한다(공정은 코드 변경을 검증하고, 본 게이트는 카탈로그 변경을 검증).

## 11. 테스트 전략 (self-host)

기존 테스트 관례(`node:test` + tsx, `tests/unit/...`)를 따른다.

- **단위**: 합격 판정 로직 — recall/fpRate 의 개선·동률·악화 경계 케이스 전수 (`tests/unit/promotion/decide.test.ts`).
- **통합**: 의도적으로 만든 "좋은 후보 rule"(놓침↓) 은 `PROMOTE_READY`, "나쁜 후보 rule"(헛경보↑) 은 `REJECTED` 로 분기되는지.
- **안전(T-PROMO)**: `fixturesHash`/`approvalHash` 위조 시 승인 거부, `ledger.jsonl` 수정 시 anchor 탐지.
- **도그푸딩**: 본 게이트 완성 후, 실제 신규 rule 1개를 본 게이트로 채용한 self-host 기록 1건 이상.

## 12. 비-목표

- LLM 으로 후보 rule 을 **자동 생성**하는 기능 (본 게이트는 "들일지 판단"만. 생성은 별개).
- 승격 판정에 LLM judge 투표 도입.
- skill-pack 의 자동 점수화 강행 (P3 에서 간접 신호 + 사람 검토로만).
- 가중 합산 합격 기준(엄격 기준을 MVP 정책으로 고정).
- 카탈로그 자동 편입(사람 승인 우회) — 영구 비목표(PRODUCT §3.3).

## 13. 자가 점검 체크리스트

`nekoforge promote trial` 종료 직전 본 모듈이 자체 점검(실패 시 거부):

- [ ] candidate.json 의 `kind` 가 rule|experience|skill-pack 중 하나인가?
- [ ] fixture 가 최소 기준(positive ≥ 3, negative ≥ 2)을 만족하는가?
- [ ] baseline 과 candidate 가 동일 fixturesHash 로 계산됐는가?
- [ ] trial.json 에 before/after 두 점수가 모두 기록됐는가?
- [ ] promoteVerdict 가 §4 의 4종 중 하나인가?
- [ ] PROMOTE_READY 인데 approvalHash 없이 카탈로그가 변경되지 않는가?

## 14. 기존 코드와의 접점 (실측)

| 재사용 대상 | 위치 | 용도 |
|---|---|---|
| `runBenchmark` / `BenchmarkReport` | `src/benchmark/index.ts` | 점수 산출. **P1 첫 작업 = 룰셋 주입 변형 추출** |
| `ALL_RULES` 등 / `DeterministicRule` | `src/rules/index.ts`, `rules/types.ts` | 후보 포함/제외 룰셋 구성 |
| `canonicalHash` | `src/utils/integrity.ts` | fixturesHash/approvalHash 봉인 |
| verdict enum | `src/schemas/decision.schema.ts` | promoteVerdict 어휘 재사용 |
| `registerXxx(program)` | `src/cli/commands/*.ts` | `promote` 명령 등록 패턴 |

## 15. 본 문서가 답하지 않는 것

- 점수 산출 방식 상세 → BENCHMARKS.md / `src/benchmark/index.ts`
- verdict 매핑·quality score → QUALITY-SCORE.md
- 채용된 rule/skill 의 운영(enable/disable) → RULE-PACKS.md / SKILL-PACKS.md
- 구현 task 분해·Phase 일정 → `docs/superpowers/plans/2026-05-26-promotion-gate-p1.md`
- content-hash/anchor 의 구현 상세 → SECURITY.md / `src/utils/integrity.ts`
