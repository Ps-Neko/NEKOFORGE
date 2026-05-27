# skill-pack guidance 워커 주입 (render 배선) 설계

**날짜:** 2026-05-28
**선행:** 승격 게이트 P1b/하드닝/P2/P3 완료 — main `c52b252`. P3 가 남긴 후속(render 미배선).
**관련:** `docs/SKILL-PACKS.md`(skill-pack 정체성), P3 스펙(promoted skill-pack).

## 0. 한 줄 정의

워커 프롬프트 생성 시 **활성(enabled) skill-pack 의 guidance(내장 카탈로그 + 채용분)**를 `## 스킬팩 지침` 블록으로 주입한다. 그동안 정의만 있고 미사용이던 `renderSkillGuidance` 를 dispatch/auto 경로에 연결한다.

## 1. 동기 / 문제

`renderSkillGuidance(enabledPacks)` 는 `src/skill-packs/render.ts` 에 정의돼 있으나 **워커 dispatch 경로(`renderPrompt`)에서 호출되지 않는다**(catalog.test.ts 에서만 참조). 결과: skill-packs.json 으로 pack 을 enable 해도, 그 guidance 가 워커 프롬프트에 실제로 들어가지 않는다. P3 로 채용된 skill-pack 역시 enable 까지만 되고 워커엔 미반영. 본 작업은 그 연결을 완성한다.

## 2. 핵심 설계 결정 (확정)

1. **enabled 전체 주입** (사용자 승인). skill-packs.json 의 `enabledPacks` + 채용분(promoted)의 guidance 를 모든 워커 프롬프트에 주입. 역할/`appliesTo` 별 필터는 후속(YAGNI) — 프로젝트가 의도적으로 enable 한 것이므로 전부 노출.
2. **`renderPrompt` 는 순수 유지.** guidance 텍스트 계산(파일 IO)은 deps 를 가진 호출부에서 하고, `renderPrompt` 에는 `context.skillGuidance` 문자열로 전달. → renderPrompt 단위 테스트 용이.
3. **중앙 헬퍼.** `renderPrompt` 호출부 3곳(runDispatch / runDispatchAll / auto)이 동일 로직을 쓰므로 `resolveSkillGuidance(deps)` 1개로 중앙화(DRY).
4. **graceful.** skill-packs.json 없거나 enabled 가 비면 guidance 블록 생략(회귀 0).

## 3. 컴포넌트별 변경

### 3.1 `src/skill-packs/render.ts`
- `renderSkillGuidance(enabledPacks: ReadonlyArray<string>, promotedDefs: ReadonlyArray<SkillPackDef> = [])` — id 해석을 `findSkillPack(id) ?? promotedDefs.find((d) => d.id === id)` 로(채용분 포함). 2번째 인자 옵셔널이라 기존 호출(catalog.test) 하위호환.

### 3.2 `src/skill-packs/promoted.ts`
- `loadPromotedSkillPackDefs(artifact: FsArtifact): Promise<SkillPackDef[]>` — `readPromotedSkillPacks` 의 entries 를 `{id, appliesTo, guidance}` 로 매핑(promotedAt/approvalHash 제외).

### 3.3 `src/skill-packs/index.ts`
- `resolveSkillGuidance(deps: StageDeps): Promise<string>` — `readSkillPacks(deps)` 로 enabledPacks 획득(없으면 빈 배열) + `loadPromotedSkillPackDefs(deps.artifact)` → `renderSkillGuidance(enabled, promotedDefs)`. enabled 비면 "".

### 3.4 `src/workers/dispatch.ts`
- `PromptContext` 에 `skillGuidance?: string` 추가.
- `runDispatch`/`runDispatchAll`: `const skillGuidance = await resolveSkillGuidance(deps);` 계산 → `renderPrompt(..., { spec, plan, skillGuidance })`.
- `renderPrompt`: `context.skillGuidance` 가 비어있지 않으면 `## 스킬팩 지침 (skill-pack guidance)` 블록을 contextBlock 다음에 삽입(standard + autonomous 양 분기 공통).

### 3.5 `src/core/auto/index.ts`
- autonomous 프롬프트 생성부(`renderPrompt(..., { goal, spec, plan, autonomous: true })`)에 `skillGuidance: await resolveSkillGuidance(deps)` 추가.

## 4. 데이터 흐름

```
runDispatch / runDispatchAll / runAuto
   → resolveSkillGuidance(deps)
        · readSkillPacks(deps).enabledPacks
        · loadPromotedSkillPackDefs(deps.artifact)
        · renderSkillGuidance(enabled, promotedDefs)   // findSkillPack ?? promotedDefs
   → renderPrompt(..., { ..., skillGuidance })
        · skillGuidance 있으면 "## 스킬팩 지침" 블록 삽입
   → 워커 프롬프트에 지침 포함 → 워커가 실제로 받음
```

채용(promoted) → enable → 이제 워커 프롬프트에 guidance 가 실제로 주입됨(P3 루프 완성).

## 5. 에러 처리 / 엣지

| 상황 | 처리 |
|---|---|
| skill-packs.json 없음 | readSkillPacks null → enabled [] → guidance "" → 블록 생략 |
| enabledPacks 비어있음 | guidance "" → 블록 생략 |
| enabled id 가 카탈로그/promoted 어디에도 없음 | renderSkillGuidance 가 해당 id 건너뜀(기존 동작) |
| promoted-skill-packs.json 없음 | loadPromotedSkillPackDefs [] → 내장만 |

## 6. 테스트 전략 (TDD)

- **단위** `render.test`(catalog.test 확장 또는 신규): `renderSkillGuidance(enabled, promotedDefs)` 가 promoted id 를 해석해 guidance 렌더 / 내장+promoted 혼합.
- **단위** `dispatch` renderPrompt: `context.skillGuidance` 주입 시 "## 스킬팩 지침" 포함, 없으면 미포함(standard + autonomous).
- **통합** `runDispatch`: enabled+promoted 가 있는 deps 로 dispatch → 생성 프롬프트(promptBody)에 guidance 텍스트 포함.
- **회귀**: skill-packs.json 없을 때 기존 프롬프트 불변(블록 없음). 기존 dispatch/auto/skill-pack 테스트 green.

## 7. 완료 기준 (DoD)

- `npm run verify` 0 exit, depcheck 위반 0.
- enabled skill-pack(내장+promoted)의 guidance 가 dispatch/auto 워커 프롬프트에 주입됨.
- skill-packs.json 없거나 enabled 비면 블록 생략(회귀 0).
- 기존 테스트 green.

## 8. 비-목표 (YAGNI)

- 역할/`appliesTo` 별 guidance 필터링(예: web-ui-quality 는 design-reviewer 에게만) — 후속.
- guidance 길이 제한·요약.
- skill-pack 버전/우선순위.
