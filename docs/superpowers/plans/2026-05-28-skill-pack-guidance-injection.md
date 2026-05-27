# skill-pack guidance 워커 주입 (render 배선) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미사용이던 `renderSkillGuidance` 를 dispatch/auto 워커 프롬프트 경로에 연결해, 활성(enabled) skill-pack(내장 카탈로그 + 채용분)의 guidance 가 워커 프롬프트에 주입되게 한다.

**Architecture:** guidance 텍스트 계산은 `resolveSkillGuidance(deps)` 헬퍼로 중앙화(파일 IO), `renderPrompt` 는 순수 유지하고 `context.skillGuidance` 문자열만 받아 블록 삽입. renderSkillGuidance 는 promoted def 를 2번째 인자로 받아 채용분도 해석.

**Tech Stack:** TypeScript 5.7 (ESM, `.js` import), `node:test` + `tsx`.

**경로 주의:** `C:/Users/Mun/NEKOFORGE`, 브랜치 `feat/skill-pack-guidance-injection` (스펙 `7108267` 위).

**설계 출처:** `docs/superpowers/specs/2026-05-28-skill-pack-guidance-injection-design.md`.

---

## File Structure

- **Modify** `src/skill-packs/render.ts` — `renderSkillGuidance(enabled, promotedDefs?)`.
- **Modify** `src/skill-packs/promoted.ts` — `loadPromotedSkillPackDefs`.
- **Modify** `src/skill-packs/index.ts` — `resolveSkillGuidance(deps)`.
- **Modify** `src/workers/dispatch.ts` — `PromptContext.skillGuidance` + 블록 삽입 + runDispatch/All 배선.
- **Modify** `src/core/auto/index.ts` — autonomous 프롬프트에 guidance 주입.
- **Modify** `docs/SKILL-PACKS.md` — guidance 워커 주입 연결됨 표기.
- **Test** `tests/unit/skill-packs/render.test.ts`, `tests/unit/skill-packs/promoted.test.ts`(추가), `tests/unit/skill-packs/promoted-visibility.test.ts`(추가), `tests/unit/workers/dispatch-guidance.test.ts`.

---

## Task 1: renderSkillGuidance 가 promoted def 해석

**Files:**
- Modify: `src/skill-packs/render.ts`
- Test: `tests/unit/skill-packs/render.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// tests/unit/skill-packs/render.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSkillGuidance } from "../../../src/skill-packs/render.js";

test("renderSkillGuidance: promotedDefs 의 pack 도 렌더", () => {
  const out = renderSkillGuidance(["promo-x"], [{ id: "promo-x", appliesTo: "UI", guidance: ["use aria-label"] }]);
  assert.match(out, /promo-x/);
  assert.match(out, /aria-label/);
});

test("renderSkillGuidance: 내장 + promoted 혼합", () => {
  const out = renderSkillGuidance(
    ["typescript-quality", "promo-x"],
    [{ id: "promo-x", appliesTo: "UI", guidance: ["g"] }]
  );
  assert.match(out, /typescript-quality/);
  assert.match(out, /promo-x/);
});

test("renderSkillGuidance: 미해석 id 는 건너뜀", () => {
  assert.equal(renderSkillGuidance(["nonexistent"], []).trim(), "");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/skill-packs/render.test.ts`
Expected: FAIL — promotedDefs 인자 미지원이라 "promo-x" 미렌더(첫 테스트 fail).

- [ ] **Step 3: 구현** — `src/skill-packs/render.ts` 전체 교체:

```ts
/**
 * Skill pack render (Phase RP) — worker prompt 에 skill guidance 주입.
 */
import { findSkillPack, type SkillPackDef } from "./catalog.js";

export function renderSkillGuidance(
  enabledPacks: ReadonlyArray<string>,
  promotedDefs: ReadonlyArray<SkillPackDef> = []
): string {
  const parts: string[] = [];
  for (const id of enabledPacks) {
    const def = findSkillPack(id) ?? promotedDefs.find((d) => d.id === id);
    if (!def) continue;
    parts.push(`## ${def.id} (${def.appliesTo})`);
    for (const g of def.guidance) parts.push(`- ${g}`);
    parts.push("");
  }
  return parts.join("\n");
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/skill-packs/render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/skill-packs/render.ts tests/unit/skill-packs/render.test.ts
git commit -m "feat(skill-packs): renderSkillGuidance 가 promoted def 해석(2번째 인자)"
```

---

## Task 2: loadPromotedSkillPackDefs

**Files:**
- Modify: `src/skill-packs/promoted.ts`
- Test: `tests/unit/skill-packs/promoted.test.ts` (추가)

- [ ] **Step 1: 추가 실패 테스트**

`tests/unit/skill-packs/promoted.test.ts` 상단 import 에 `loadPromotedSkillPackDefs` 추가:

```ts
import {
  readPromotedSkillPacks, writePromotedSkillPacks, loadPromotedSkillPackIds, loadPromotedSkillPackDefs
} from "../../../src/skill-packs/promoted.js";
```

하단에 테스트 추가:

```ts
test("loadPromotedSkillPackDefs: 매니페스트 → SkillPackDef[]", async () => {
  const a = await fresh();
  await writePromotedSkillPacks(a, {
    packs: [{ id: "p1", appliesTo: "X", guidance: ["g"], promotedAt: "t", approvalHash: "h" }]
  });
  const defs = await loadPromotedSkillPackDefs(a);
  assert.equal(defs.length, 1);
  assert.deepEqual(defs[0], { id: "p1", appliesTo: "X", guidance: ["g"] });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted.test.ts`
Expected: FAIL — `loadPromotedSkillPackDefs` export 없음.

- [ ] **Step 3: 구현** — `src/skill-packs/promoted.ts` 하단에 추가:

```ts
export async function loadPromotedSkillPackDefs(artifact: FsArtifact): Promise<SkillPackDef[]> {
  const m = await readPromotedSkillPacks(artifact);
  return m.packs.map((p) => ({ id: p.id, appliesTo: p.appliesTo, guidance: p.guidance }));
}
```

> `SkillPackDef` 는 promoted.ts 가 이미 `import type { SkillPackDef } from "./catalog.js";` 로 가져온다(PromotedSkillPackEntry extends SkillPackDef). 추가 import 불필요.

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/skill-packs/promoted.ts tests/unit/skill-packs/promoted.test.ts
git commit -m "feat(skill-packs): loadPromotedSkillPackDefs (매니페스트 → SkillPackDef[])"
```

---

## Task 3: resolveSkillGuidance 헬퍼

**Files:**
- Modify: `src/skill-packs/index.ts`
- Test: `tests/unit/skill-packs/promoted-visibility.test.ts` (추가)

- [ ] **Step 1: 추가 실패 테스트**

`tests/unit/skill-packs/promoted-visibility.test.ts` 상단 import 에 추가:

```ts
import { ensureSkillPacks, resolveSkillGuidance } from "../../../src/skill-packs/index.js";
```

(기존 import 줄 `import { enableSkillPack, getSkillPackStatus } from ...` 와 합치거나 별도 줄로 추가)

하단에 테스트 추가:

```ts
test("resolveSkillGuidance: enabled(내장+promoted) guidance 렌더", async () => {
  const deps = await depsWithPromoted();
  await ensureSkillPacks(deps);
  await enableSkillPack("typescript-quality", deps);
  await enableSkillPack("promo-x", deps);
  const g = await resolveSkillGuidance(deps);
  assert.match(g, /typescript-quality/);
  assert.match(g, /promo-x/);
});

test("resolveSkillGuidance: skill-packs.json 없으면 빈 문자열", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spv-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  const deps = buildDeps(dir);
  assert.equal(await resolveSkillGuidance(deps), "");
});
```

> `depsWithPromoted()`/`buildDeps`/`mkdtemp`/`mkdir`/`tmpdir`/`join` 는 기존 promoted-visibility.test.ts 에 이미 있다. `depsWithPromoted` 는 promo-x 를 promoted-skill-packs.json 에 써 두므로 `enableSkillPack("promo-x")` 가 성공한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted-visibility.test.ts`
Expected: FAIL — `resolveSkillGuidance` export 없음.

- [ ] **Step 3: 구현** — `src/skill-packs/index.ts`.

상단 import: 기존 `import { loadPromotedSkillPackIds } from "./promoted.js";` 를 다음으로 교체 + render import 추가:

```ts
import { loadPromotedSkillPackIds, loadPromotedSkillPackDefs } from "./promoted.js";
import { renderSkillGuidance } from "./render.js";
```

파일 하단에 함수 추가:

```ts
/** 활성(enabled) skill-pack(내장 카탈로그 + 채용분)의 worker guidance 텍스트. enabled 비면 "". */
export async function resolveSkillGuidance(deps: StageDeps): Promise<string> {
  const sp = await readSkillPacks(deps);
  const enabled = sp?.enabledPacks ?? [];
  if (enabled.length === 0) return "";
  const promotedDefs = await loadPromotedSkillPackDefs(deps.artifact);
  return renderSkillGuidance(enabled, promotedDefs);
}
```

> `StageDeps` 와 `readSkillPacks` 는 index.ts 안에 이미 있다.

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted-visibility.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/skill-packs/index.ts tests/unit/skill-packs/promoted-visibility.test.ts
git commit -m "feat(skill-packs): resolveSkillGuidance — enabled(내장+채용분) guidance 텍스트"
```

---

## Task 4: dispatch 워커 프롬프트에 guidance 주입

**Files:**
- Modify: `src/workers/dispatch.ts`
- Test: `tests/unit/workers/dispatch-guidance.test.ts`

- [ ] **Step 1: 실패 테스트(통합)**

```ts
// tests/unit/workers/dispatch-guidance.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../../src/core/stage-runner.js";
import { runWorkersInit } from "../../../src/workers/index.js";
import { ensureSkillPacks } from "../../../src/skill-packs/index.js";
import { runDispatch } from "../../../src/workers/dispatch.js";

async function freshDeps() {
  const dir = await mkdtemp(join(tmpdir(), "disp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return buildDeps(dir);
}

test("runDispatch: enabled skill-pack guidance 가 프롬프트에 주입", async () => {
  const deps = await freshDeps();
  await runWorkersInit({ profile: "standard", force: true }, deps);
  await ensureSkillPacks(deps); // default enabled: typescript-quality, evidence-writing
  const r = await runDispatch({ taskId: "t1", worker: "implementation-worker" }, deps);
  assert.match(r.promptBody, /스킬팩 지침/);
  assert.match(r.promptBody, /typescript-quality/);
});

test("runDispatch: skill-packs.json 없으면 guidance 블록 생략", async () => {
  const deps = await freshDeps();
  await runWorkersInit({ profile: "standard", force: true }, deps);
  const r = await runDispatch({ taskId: "t2", worker: "implementation-worker" }, deps);
  assert.equal(/스킬팩 지침/.test(r.promptBody), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/workers/dispatch-guidance.test.ts`
Expected: FAIL — guidance 미주입이라 첫 테스트 "스킬팩 지침" 없음.

- [ ] **Step 3: 구현** — `src/workers/dispatch.ts`.

상단 import 에 추가:

```ts
import { resolveSkillGuidance } from "../skill-packs/index.js";
```

`PromptContext` 인터페이스에 필드 추가:

```ts
export interface PromptContext { goal?: string; spec?: string; plan?: string; autonomous?: boolean; skillGuidance?: string; }
```

`renderPrompt` 안, `contextBlock` 정의 다음에 `guidanceBlock` 추가:

```ts
  const guidanceBlock = context.skillGuidance
    ? [`## 스킬팩 지침 (skill-pack guidance)`, "", context.skillGuidance.trim(), ""].join("\n")
    : "";
```

autonomous 분기 return 배열에서 `contextBlock,` 다음 줄에 `guidanceBlock,` 삽입:

```ts
      goalBlock,
      contextBlock,
      guidanceBlock,
      `## 임무`,
```

standard 분기 return 배열에서도 `contextBlock,` 다음 줄에 `guidanceBlock,` 삽입:

```ts
    goalBlock,
    contextBlock,
    guidanceBlock,
    `## 임무`,
```

`runDispatch` 의 renderPrompt 호출(현재 `const body = renderPrompt(input.taskId, input.worker, workers, { spec, plan });`) 교체:

```ts
        const skillGuidance = await resolveSkillGuidance(deps);
        const body = renderPrompt(input.taskId, input.worker, workers, { spec, plan, skillGuidance });
```

`runDispatchAll` 의 renderPrompt 호출(현재 `const body = renderPrompt(input.taskId, role, workers, { spec, plan });`) 교체 — for 루프 직전에 `skillGuidance` 1회 계산:

```ts
  const spec = (await deps.artifact.readMarkdown("SPEC.md")) ?? undefined;
  const plan = (await deps.artifact.readMarkdown("PLAN.md")) ?? undefined;
  const skillGuidance = await resolveSkillGuidance(deps);
  const prompts: Array<{ role: WorkerRole; path: string }> = [];
  for (const role of roles) {
    const body = renderPrompt(input.taskId, role, workers, { spec, plan, skillGuidance });
```

> `runDispatch` 의 `const body = ...` 줄은 들여쓰기가 8칸이 아닐 수 있으니, `grep -n "renderPrompt(input.taskId, input.worker" src/workers/dispatch.ts` 로 정확한 줄을 찾아 위 2줄로 교체(skillGuidance 계산 + 전달).

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/workers/dispatch-guidance.test.ts`
Then: `node --test --import tsx tests/unit/workers/*.test.ts` (dispatch 회귀)
Expected: PASS (2 + 기존 green).

- [ ] **Step 5: 커밋**

```bash
git add src/workers/dispatch.ts tests/unit/workers/dispatch-guidance.test.ts
git commit -m "feat(workers): dispatch 워커 프롬프트에 skill-pack guidance 주입"
```

---

## Task 5: auto 배선 + 회귀 + 문서

**Files:**
- Modify: `src/core/auto/index.ts`
- Modify: `docs/SKILL-PACKS.md`
- Verify only: 전체

- [ ] **Step 1: auto autonomous 프롬프트에 guidance 주입**

`src/core/auto/index.ts` 상단 import 에 추가:

```ts
import { resolveSkillGuidance } from "../../skill-packs/index.js";
```

renderPrompt 호출부(현재):

```ts
    const prompt = workers
      ? renderPrompt(taskId, "implementation-worker", workers, { goal: input.goal, spec, plan, autonomous: true })
      : `# Worker Prompt\ntask: ${taskId}\nrole: implementation-worker\ngoal: ${input.goal}\n`;
```

교체:

```ts
    const skillGuidance = await resolveSkillGuidance(deps);
    const prompt = workers
      ? renderPrompt(taskId, "implementation-worker", workers, { goal: input.goal, spec, plan, autonomous: true, skillGuidance })
      : `# Worker Prompt\ntask: ${taskId}\nrole: implementation-worker\ngoal: ${input.goal}\n`;
```

- [ ] **Step 2: 전체 verify**

Run: `npm run verify`
Expected: 0 exit. depcheck 0(workers→skill-packs, core/auto→skill-packs 금지 규칙 없음). 전체 GREEN (P3 431 + 신규: render 3 + promoted 1 + visibility 2 + dispatch 2 = 439).

- [ ] **Step 3: CLI 스모크** (PowerShell)

```powershell
$ws = Join-Path $env:TEMP ("guid-" + [System.Guid]::NewGuid().ToString("N").Substring(0,8))
$cli = "src/cli/index.ts"
node --import tsx $cli --workspace $ws init 2>$null
node --import tsx $cli --workspace $ws workers init --profile standard
node --import tsx $cli --workspace $ws dispatch t1 --worker implementation-worker 2>$null
Get-Content (Join-Path $ws ".harness\worker-runs\t1\implementation-worker.prompt.md") | Select-String "스킬팩 지침|typescript-quality"
```

Expected: 프롬프트 파일에 "스킬팩 지침" + enabled pack(typescript-quality) 노출. (init 이 skill-packs.json 기본 생성 여부에 따라 다름 — 없으면 `skill-pack enable typescript-quality` 후 재확인.)

- [ ] **Step 4: 문서** — `docs/SKILL-PACKS.md` §1 아래에 한 줄 추가(guidance 가 이제 워커 프롬프트에 실제 주입됨 표기).

`docs/SKILL-PACKS.md` 의 `skill pack 누락은 직접 BLOCK 아님 — warning 또는 NEEDS_HUMAN_REVIEW` 줄 다음(코드블록 ``` 다음 빈 줄)에 추가:

```text

> (2026-05) enabled skill pack(내장+채용분)의 guidance 는 `renderSkillGuidance` 를 통해 dispatch/auto 워커 프롬프트에 `## 스킬팩 지침` 블록으로 주입된다.
```

- [ ] **Step 5: 최종 verify + 커밋**

Run: `npm run verify`
Expected: 0 exit, 전체 GREEN.

```bash
git add src/core/auto/index.ts docs/SKILL-PACKS.md
git commit -m "feat(auto): autonomous 프롬프트에 skill-pack guidance 주입 + 문서"
```

---

## 완료 기준 (Definition of Done)

- `npm run verify` 0 exit, depcheck 위반 0.
- enabled skill-pack(내장+promoted)의 guidance 가 dispatch/auto 워커 프롬프트에 `## 스킬팩 지침` 블록으로 주입.
- skill-packs.json 없거나 enabled 비면 블록 생략(회귀 0).
- 기존 dispatch/auto/skill-pack 테스트 green.

## 후속 (밖)

- 역할/`appliesTo` 별 guidance 필터(예: web-ui-quality 는 design-reviewer 에게만).
- guidance 길이 제한·요약.
