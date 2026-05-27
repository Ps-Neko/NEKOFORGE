# Promotion Gate P3 — skill-pack 승격 (얇은 사람검토) 설계

**날짜:** 2026-05-28
**선행:** P1b(PR #3) + 하드닝(PR #5) + P2(PR #6) — main `a0e0d89`.
**설계 출처:** `docs/PROMOTION-GATE.md` §3(③ skill-pack, P3 후속), §6·§12. `docs/SKILL-PACKS.md`.

## 0. 한 줄 정의

skill-pack(워커 행동 지침 번들)을 카탈로그에 들이는 **사람 검토 승격**. 점수화가 원리적으로 불가하므로 trial 없이 **`--approved` 사람 도장이 유일 게이트**. 룰(P1)·경험(P2)과 동일한 위변조 불가 감사 추적(ledger)을 skill-pack 에도 부여 → 승격 게이트 3대상 완성.

## 1. 핵심 설계 결정 (확정)

1. **자동 점수화 없음.** skill-pack 은 verdict 를 안 만들어 criticalRecall/fpRate 로 채점 불가(SKILL-PACKS.md §1). trial/benchmark 생략. 사람 검토가 게이트(PROMOTION-GATE.md §3·§6 "간접신호+사람검토" 중 사람검토 채택, 간접신호 자동측정은 비-목표 — "좋아 보임의 함정" 회피).
2. **후보 = JSON 파일** (사용자 결정). `SkillPackDef`({id, appliesTo, guidance[]}) JSON. 검토 가능한 산출물.
3. **런타임 합류 = 채용기록 + 최소 가시성** (사용자 결정). 채용분을 `promoted-skill-packs.json`+ledger 에 봉인하고, **현재 살아있는 소비 지점**(enable/status/`promote list-packs`)이 promoted 를 인식. `renderSkillGuidance`(워커 프롬프트 주입)는 **src 에서 호출부가 없는 미배선 함수**이므로 그쪽 깊은 합류는 render 가 실제 배선될 때 후속(지금 하면 헛일).
4. **provenance(P2 재사용).** `--experience <evalCaseId>` 로 동기가 된 경험 링크 가능(선택).
5. **ledger 공유.** skill-pack 승격 이벤트도 `promotions/ledger.jsonl`(chain+anchor)에 적재 → 룰·경험·skill-pack 단일 감사 추적.

## 2. 아키텍처

P1b 의 ledger(`promotions/ledger.jsonl` + anchor)·artifact·canonicalHash 를 재사용한다. trial/benchmark/promoted-rule 경로는 건드리지 않는다. skill-pack 은 데이터(코드 모듈 아님)이므로 dynamic import 없음.

- **promotion 측**(core/promotion): 후보 검증 + submit/approve/reject + ledger 적재 + 매니페스트 봉인.
- **skill-packs 측**(src/skill-packs): promoted 매니페스트 타입·read/write + 기존 enable/status 가 promoted 인식.
- 두 측은 `promoted-skill-packs.json` 아티팩트 파일로 통신(코드 결합 최소). 매니페스트 타입은 skill-packs 도메인이 소유, core/promotion 이 import(core→skill-packs 허용, 역방향 없음).

## 3. 컴포넌트별 변경

### 3.1 `src/skill-packs/promoted.ts` (신규)
- `PromotedSkillPackEntry = SkillPackDef & { promotedAt: string; approvalHash: string; experiences?: string[] }`
- `PromotedSkillPacksManifest = { packs: PromotedSkillPackEntry[] }`
- `readPromotedSkillPacks(artifact: FsArtifact): Promise<PromotedSkillPacksManifest>` (없으면 `{ packs: [] }`)
- `writePromotedSkillPacks(artifact: FsArtifact, manifest): Promise<void>` (artifact.writeJson `promoted-skill-packs.json`)
- `loadPromotedSkillPackIds(artifact: FsArtifact): Promise<Set<string>>` (가시성용)

> 모든 헬퍼는 `artifact: FsArtifact` 를 받는다(promotion store 와 일관). skill-packs/index 의 deps-기반 함수는 `deps.artifact` 를 넘긴다.

### 3.2 `src/core/promotion/skill-pack.ts` (신규)
- `SkillPackCandidate = SkillPackDef & { submittedAt: string; experiences?: string[] }`
- `validateSkillPackCandidate(def, builtinIds): { ok; reason? }` — id/appliesTo 비어있지 않음, guidance 가 비어있지 않은 string[], id 가 builtin 카탈로그(SKILL_PACK_CATALOG)와 충돌 안 함.
- `submitSkillPack(artifact, cand)` — `promotions/<id>/skill-pack.json` 저장 + ledger(action "submit").
- `approveSkillPack(artifact, id, opts)` — 후보 로드 → promoted 중복 id 거부(readPromotedSkillPacks) → `approvalHash=canonicalHash(skill-pack.json)` → `PromotedSkillPackEntry` 를 매니페스트에 append(writePromotedSkillPacks) + `decision.json` + ledger(action "approve"). 모두 `artifact` 경유.
- `rejectSkillPack(artifact, id, reason, clockNow)` — decision(rejected) + ledger.

### 3.3 `src/core/promotion/store.ts` (수정)
- 기존 private `appendLedger` 를 **export** (skill-pack.ts 가 같은 ledger+anchor 경로를 재사용 → 통합 감사·동일 위변조 방어).

### 3.4 `src/skill-packs/index.ts` (수정 — 최소 가시성)
- `enableSkillPack(packId, deps)`: `findSkillPack(packId)` 실패 시 promoted 도 확인(`loadPromotedSkillPackIds`) — 채용된 pack 도 enable 가능.
- `getSkillPackStatus(deps)`: `unknownEnabled` 에서 promoted id 제외(채용된 pack 을 "unknown" 으로 오인 안 함).

### 3.5 `src/cli/commands/promote.ts` (수정)
- `submit-pack <id> --pack-file <path> [--experience <id>...]` — JSON 로드 → validateSkillPackCandidate → submitSkillPack. 잘못된 pack → `INVALID_SKILL_PACK`(exit 4).
- `approve-pack <id> --approved [--by <who>]` — approveSkillPack. promoted 중복/후보 없음 → 거부(exit).
- `reject-pack <id> [--reason]` — rejectSkillPack.
- `list-packs` — promoted-skill-packs.json 의 채용 pack 목록(+experiences).

## 4. 데이터 흐름

```
사람이 skill-pack JSON 작성 ({id, appliesTo, guidance[]})
  → promote submit-pack ui-a11y-extra --pack-file ./pack.json [--experience <ec>]
       · validateSkillPackCandidate (구조 + builtin 충돌)
       · promotions/<id>/skill-pack.json + ledger(submit)
  → 사람 검토 (JSON diff)
  → promote approve-pack ui-a11y-extra --approved
       · promoted 중복 검사 → approvalHash 봉인 → promoted-skill-packs.json append + decision + ledger(approve)
  → skill-pack enable ui-a11y-extra      (promoted 인식 → "unknown" 아님, enable 성공)
  → promote list-packs                   (채용 pack + 출처 표시)
```

render(워커 guidance 주입)는 미배선이라 본 P3 범위 밖(후속).

## 5. 에러 처리 / 엣지

| 상황 | 처리 |
|---|---|
| pack JSON 필드 누락(id/appliesTo/guidance) | `INVALID_SKILL_PACK`(exit 4) |
| guidance 가 빈 배열 | `INVALID_SKILL_PACK`(빈 지침은 무의미) |
| id 가 builtin 카탈로그와 충돌 | 거부(중복 등록 방지) |
| approve 시 promoted 에 이미 같은 id | 거부(중복 채용 방지) |
| approve 전 후보 없음 | 거부(exit) |
| `--experience` 없는 eval-case | P2 `validateExperiences` 재사용 → 거부 |

## 6. 테스트 전략 (TDD)

- **단위** `skill-pack.test.ts`: validateSkillPackCandidate(정상/필드누락/빈 guidance/builtin 충돌), submitSkillPack(저장+ledger), approveSkillPack(매니페스트 봉인+approvalHash, 중복 거부, 후보 없음 거부), rejectSkillPack.
- **단위** `skill-packs/promoted.test.ts` 또는 index 테스트: enable/status 가 promoted 인식(채용 pack enable 성공, unknown 미오인).
- **통합** `promote-cli.test.ts` 추가: submit-pack(유효 파일→저장 / 잘못된 파일→exit 4), approve-pack→list-packs 에 표시.
- **회귀**: 기존 promotion·skill-pack·gate 테스트 green 유지.

## 7. 완료 기준 (DoD)

- `npm run verify` 0 exit, depcheck 위반 0.
- `submit-pack→approve-pack` 가 promoted-skill-packs.json + ledger + decision 을 만들고 approvalHash 봉인.
- 채용된 pack 이 `skill-pack enable` 로 활성화되고 status 에서 "unknown" 으로 오인되지 않음.
- `promote list-packs` 가 채용 pack 표시. 잘못된 pack 은 exit 4.
- 회귀 0.

## 8. 비-목표 (YAGNI)

- 자동 점수화 / 간접신호 측정(불가·trap).
- render(워커 guidance 주입)로의 깊은 합류 — render 가 실제 배선될 때 후속.
- skill-pack 버전 관리·diff 머지.
