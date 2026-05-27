# Promotion Gate P2 — experience → rule (얇은 provenance) 설계

**날짜:** 2026-05-28
**선행:** P1b 승격 게이트(PR #3) + 후속 하드닝(PR #5) — main `499648f` 기준.
**설계 출처:** `docs/PROMOTION-GATE.md` §3(세 대상 — ② 경험→rule, P2), §12(코드 자동생성 금지).

## 0. 한 줄 정의

승격된 룰이 **"왜 카탈로그에 있는가"**에 실제 미탐/오탐 경험(eval-case)으로 답하게 만든다. 채용 판정은 P1b 그대로, **후보↔경험 출처(provenance) 링크만** 더한다.

## 1. 동기 / 문제

P1b 로 룰을 시험·승인·채용할 수 있지만, **그 룰이 어떤 실제 사례 때문에 필요한지** 기록이 없다. NEKOFORGE 는 이미 `nekoforge memory add` 로 평가 사례(eval-case: false_negative/missed_risk/false_positive/noisy_rule/...)를 `.harness/eval-cases/` 에 쌓는다. P2 는 그 경험을 룰 승격의 **근거로 묶어**, 카탈로그를 감사 가능하게(모든 채용 룰이 실제 미탐/오탐으로 소급) 만든다.

## 2. 핵심 설계 결정 (확정)

1. **fixture 의 diff 출처 = promote 시 제출** (사용자 결정). eval-case 는 가벼운 근거/포인터로 두고, 경험에 해당하는 fixture(`last-diff.patch`+`expected.json`)는 `promote submit/trial` 시 `--fixtures` 로 제출한다. **eval-case 스키마 불변.** → P1b 흐름 완전 재사용.
2. **범위 = 얇은 provenance 링크** (사용자 결정). 신규 채점·verdict 없음. P1b 의 trial/비교/판정/승인/채용/봉인 그대로. P2 는 후보에 eval-case 참조를 붙이고 검증·봉인만 한다.
3. **코드 자동생성 없음** (§12). 룰 모듈은 사람/AI 가 작성(P1b 와 동일). P2 는 경험에서 룰을 자동 생성하지 않는다.
4. **provenance 는 선택적.** `--experience` 미지정 시 기존 P1b 동작(경험 없는 룰 승격)도 계속 허용한다.

## 3. 아키텍처

P1b 승격 엔진(candidate / trial / store / promoted / ledger / promote CLI)을 **그대로 재사용**한다. P2 가 더하는 것은 다음 셋뿐:

- **타입 2필드**: 후보·채용 레코드에 `experiences?: string[]`.
- **검증 함수 1개**: `validateExperiences` — 참조한 eval-case 가 실재하고 룰 관련 kind 인지.
- **CLI 플래그 + 봉인 1줄**: `submit --experience`, approve 시 candidate→promoted 복사.

cross-stage 영향 없음: eval-case 는 `artifact.readJson("eval-cases/<id>.json")` 로 읽으므로 `core/memory` 직접 import 불필요(depcruise 무영향).

## 4. 컴포넌트별 변경

### 4.1 `src/core/promotion/store-types.ts`
- `CandidateDef` 에 `experiences?: string[]` (eval-case id 목록) 추가.
- `PromotedRuleEntry` 에 `experiences?: string[]` (채용 시 봉인되는 출처) 추가.

### 4.2 `src/core/promotion/experience.ts` (신규)
- 유효 경험 kind 집합(룰 관련): `false_positive`, `false_negative`, `missed_risk`, `noisy_rule`, `useful_rule`.
  - 제외: `improved_prompt`, `changed_workflow`, `milestone_passed` (룰 정확성과 무관).
- `EvalCaseReader = (id: string) => Promise<{ kind: string } | null>` (주입형 — 테스트 가능).
- `validateExperiences(ids, readEvalCase): Promise<{ ok: boolean; reason?: string }>`
  - 각 id 에 대해 reader 가 null → "eval-case <id> 없음".
  - kind 가 유효 집합 밖 → "kind <k> 는 룰 관련 경험이 아님(유효: ...)".
  - 모두 통과 → ok.

### 4.3 `src/cli/commands/promote.ts` — `submit`
- 옵션 추가: `--experience <id>` (반복 가능; commander `.option(..., collect, [])` 패턴).
- action: `validateExperiences(ids, readEvalCase)` 로 검증(reader 주입: `readEvalCase = (id) => deps.artifact.readJson("eval-cases/" + id + ".json")`). 실패 시 `INVALID_EXPERIENCE`(exit 4) throw. — §4.2 의 주입형 설계와 일치.
- 통과 시 `CandidateDef.experiences = ids` 로 candidate.json 에 기록.
- `promote list` 출력에 룰별 `experiences` 표시(있으면).

### 4.4 `src/core/promotion/store.ts` — `approveCandidate`
- `PromotedRuleEntry` 생성 시 `experiences: cand.experiences` 복사(undefined 면 생략). → promoted.json + (기존) ledger append 로 출처가 채용 기록에 봉인된다.

## 5. 데이터 흐름

```
nekoforge memory add --kind missed_risk --summary "..."   (기존)
   → .harness/eval-cases/<caseId>.json
사람: 그 미탐을 잡는 룰 모듈 작성 (P1b 와 동일, 자동생성 X)
   → nekoforge promote submit r1 --module ... --export ... --fixtures <dir> --experience <caseId>
        · validateExperiences: caseId 실재 + kind=missed_risk(유효) 확인
        · candidate.json.experiences = [caseId]
   → nekoforge promote trial r1 --fixtures <dir>      (P1b 불변: fixturesHash 재검증 + 채점)
   → nekoforge promote report r1                       (P1b 불변)
   → nekoforge promote approve r1 --approved           (P1b 불변 + experiences 를 promoted.json/ledger 에 봉인)
   → nekoforge promote list                            (룰 + 출처 경험 표시)
```

## 6. 에러 처리 / 엣지

| 상황 | 처리 |
|---|---|
| `--experience` 가 없는 eval-case id 참조 | `INVALID_EXPERIENCE`(exit 4) — 존재하지 않는 경험으로 근거 위조 차단 |
| 참조 eval-case 의 kind 가 룰 무관(milestone_passed 등) | exit 4 + 유효 kind 집합 안내 |
| `--experience` 미지정 | 허용(P1b 동작 불변) |
| 같은 eval-case 중복 참조 | 중복 제거(dedupe) 후 기록 |

## 7. 테스트 전략 (TDD)

- **단위** `experience.test.ts`: 실재+유효 kind → ok / 없는 id → not ok / 무관 kind → not ok / 다중 id 일부 실패 → not ok.
- **단위** `store.test.ts` 추가: approve 가 candidate.experiences 를 promoted.json entry 에 봉인.
- **통합** `promote-cli.test.ts` 추가(또는 신규): `submit --experience <존재>` 가 candidate.json 에 기록 / `--experience <없음>` 이 exit 4.
- **회귀**: 기존 promotion·gate·e2e 전부 green 유지(experiences optional 이라 미지정 경로 불변).

## 8. 완료 기준 (DoD)

- `npm run verify` 0 exit, depcheck 위반 0.
- `promote submit --experience <id>` 가 eval-case 검증 후 candidate.json 에 provenance 기록, 잘못된 참조는 exit 4.
- `approve` 가 experiences 를 promoted.json + ledger 에 봉인.
- `--experience` 없는 기존 흐름 불변(회귀 0).
- CLI 스모크: 경험 링크 submit→trial→approve→list 에서 출처가 끝까지 보존.

## 9. 비-목표 (YAGNI)

- 경험에서 룰 **자동 생성** (§12 위반).
- 경험↔fixture 시나리오 **자동 링크**/재현 강제 (P1b validateMinFixtures 가 이미 최소 fixture 보장; 수동 링크는 과설계).
- 새 verdict·새 채점·eval-case 스키마 변경.
- P3(skill-pack) — 별도.
