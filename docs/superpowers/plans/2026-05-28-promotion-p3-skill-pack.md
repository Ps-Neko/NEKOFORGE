# Promotion Gate P3 — skill-pack 승격 (얇은 사람검토) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** skill-pack 후보(JSON)를 사람 검토로 승격해 `promoted-skill-packs.json`+ledger 에 봉인하고, 채용분을 enable/status 가 인식하게 한다(자동 점수화 없음).

**Architecture:** P1b ledger(chain+anchor)·artifact·canonicalHash 재사용, trial/benchmark 생략. skill-pack 은 데이터(코드 모듈 아님)라 dynamic import 없음. promotion 측(submit/approve/reject)과 skill-packs 측(promoted 매니페스트·가시성)은 `promoted-skill-packs.json` 아티팩트로 통신. render(미배선) 깊은 합류는 비-목표.

**Tech Stack:** TypeScript 5.7 (ESM, `.js` import 접미사), `node:test` + `tsx`, `commander`. 순수 함수 + artifact 주입.

**경로 주의:** `C:/Users/Mun/NEKOFORGE`, 브랜치 `feat/promotion-p3-skill-pack` (스펙 `fd33d04` 위).

**설계 출처:** `docs/superpowers/specs/2026-05-28-promotion-p3-skill-pack-design.md`.

---

## File Structure

- **Create** `src/skill-packs/promoted.ts` — `PromotedSkillPackEntry`/`PromotedSkillPacksManifest` + read/write/loadIds(artifact).
- **Create** `src/core/promotion/skill-pack.ts` — `SkillPackCandidate`, `validateSkillPackCandidate`, `submitSkillPack`/`approveSkillPack`/`rejectSkillPack`.
- **Modify** `src/core/promotion/store.ts` — `appendLedger` export(ledger 공유).
- **Modify** `src/skill-packs/index.ts` — enable/status 가 promoted 인식.
- **Modify** `src/cli/commands/promote.ts` — submit-pack/approve-pack/reject-pack/list-packs.
- **Modify** `docs/PROMOTION-GATE.md` — §3 P3 행 구현 표기.
- **Test** `tests/unit/skill-packs/promoted.test.ts`, `tests/unit/promotion/skill-pack.test.ts`, `tests/unit/skill-packs/promoted-visibility.test.ts`, `tests/integration/promote-cli.test.ts`(추가).

---

## Task 1: promoted-skill-packs 매니페스트 (skill-packs/promoted.ts)

**Files:**
- Create: `src/skill-packs/promoted.ts`
- Test: `tests/unit/skill-packs/promoted.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// tests/unit/skill-packs/promoted.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import {
  readPromotedSkillPacks, writePromotedSkillPacks, loadPromotedSkillPackIds
} from "../../../src/skill-packs/promoted.js";

async function fresh() {
  const dir = await mkdtemp(join(tmpdir(), "sp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return new FsArtifact({ cwd: dir });
}

test("readPromotedSkillPacks: 없으면 packs []", async () => {
  const a = await fresh();
  assert.deepEqual(await readPromotedSkillPacks(a), { packs: [] });
});

test("write→read roundtrip + loadPromotedSkillPackIds", async () => {
  const a = await fresh();
  await writePromotedSkillPacks(a, {
    packs: [{ id: "p1", appliesTo: "X", guidance: ["g"], promotedAt: "t", approvalHash: "h" }]
  });
  const m = await readPromotedSkillPacks(a);
  assert.equal(m.packs.length, 1);
  const ids = await loadPromotedSkillPackIds(a);
  assert.ok(ids.has("p1"));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted.test.ts`
Expected: FAIL — `promoted.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/skill-packs/promoted.ts
import type { FsArtifact } from "../artifact/fs-artifact.js";
import type { SkillPackDef } from "./catalog.js";

export interface PromotedSkillPackEntry extends SkillPackDef {
  promotedAt: string;
  approvalHash: string;
  experiences?: string[];
}

export interface PromotedSkillPacksManifest {
  packs: PromotedSkillPackEntry[];
}

const MANIFEST = "promoted-skill-packs.json";

export async function readPromotedSkillPacks(artifact: FsArtifact): Promise<PromotedSkillPacksManifest> {
  return (await artifact.readJson<PromotedSkillPacksManifest>(MANIFEST)) ?? { packs: [] };
}

export async function writePromotedSkillPacks(
  artifact: FsArtifact,
  manifest: PromotedSkillPacksManifest
): Promise<void> {
  await artifact.writeJson(MANIFEST, manifest);
}

export async function loadPromotedSkillPackIds(artifact: FsArtifact): Promise<Set<string>> {
  const m = await readPromotedSkillPacks(artifact);
  return new Set(m.packs.map((p) => p.id));
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/skill-packs/promoted.ts tests/unit/skill-packs/promoted.test.ts
git commit -m "feat(skill-packs): promoted-skill-packs 매니페스트 read/write/loadIds"
```

---

## Task 2: validateSkillPackCandidate (promotion/skill-pack.ts)

**Files:**
- Create: `src/core/promotion/skill-pack.ts`
- Test: `tests/unit/promotion/skill-pack.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// tests/unit/promotion/skill-pack.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSkillPackCandidate } from "../../../src/core/promotion/skill-pack.js";

const builtin = new Set(["typescript-quality"]);

test("validate: 정상 → ok", () => {
  assert.equal(validateSkillPackCandidate({ id: "x", appliesTo: "Y", guidance: ["g1"] }, builtin).ok, true);
});

test("validate: id 누락 → not ok", () => {
  assert.equal(validateSkillPackCandidate({ appliesTo: "Y", guidance: ["g"] }, builtin).ok, false);
});

test("validate: 빈 guidance → not ok", () => {
  assert.equal(validateSkillPackCandidate({ id: "x", appliesTo: "Y", guidance: [] }, builtin).ok, false);
});

test("validate: builtin 충돌 → not ok + 사유", () => {
  const r = validateSkillPackCandidate({ id: "typescript-quality", appliesTo: "Y", guidance: ["g"] }, builtin);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /충돌|builtin/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/skill-pack.test.ts`
Expected: FAIL — `skill-pack.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/skill-pack.ts
import type { SkillPackDef } from "../../skill-packs/catalog.js";

export interface SkillPackCandidate extends SkillPackDef {
  submittedAt: string;
  experiences?: string[];
}

export interface SkillPackValidation {
  ok: boolean;
  reason?: string;
}

/** 후보 skill-pack JSON 구조 검증(순수). builtinIds = SKILL_PACK_CATALOG 의 id 집합. */
export function validateSkillPackCandidate(
  def: Partial<SkillPackDef>,
  builtinIds: ReadonlySet<string>
): SkillPackValidation {
  if (typeof def.id !== "string" || def.id.length === 0) return { ok: false, reason: "id 누락" };
  if (typeof def.appliesTo !== "string" || def.appliesTo.length === 0) return { ok: false, reason: "appliesTo 누락" };
  if (
    !Array.isArray(def.guidance) ||
    def.guidance.length === 0 ||
    !def.guidance.every((g) => typeof g === "string" && g.length > 0)
  ) {
    return { ok: false, reason: "guidance 는 비어있지 않은 string[] 이어야 함" };
  }
  if (builtinIds.has(def.id)) return { ok: false, reason: `id "${def.id}" 가 builtin 카탈로그와 충돌` };
  return { ok: true };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/skill-pack.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/skill-pack.ts tests/unit/promotion/skill-pack.test.ts
git commit -m "feat(promotion): validateSkillPackCandidate (구조 + builtin 충돌)"
```

---

## Task 3: submit/approve/reject skill-pack + ledger 공유

**Files:**
- Modify: `src/core/promotion/store.ts` (appendLedger export)
- Modify: `src/core/promotion/skill-pack.ts` (store 함수 추가)
- Test: `tests/unit/promotion/skill-pack.test.ts` (추가)

- [ ] **Step 1: appendLedger export**

`src/core/promotion/store.ts` 에서 `async function appendLedger(` 를 `export async function appendLedger(` 로 변경(시그니처·본문 불변).

- [ ] **Step 2: 추가 실패 테스트**

`tests/unit/promotion/skill-pack.test.ts` 하단에 추가(상단 import 에 추가 필요 — 아래 블록 맨 위 import 2줄을 파일 상단에 추가):

```ts
// (파일 상단 import 에 추가)
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import {
  submitSkillPack, approveSkillPack, rejectSkillPack, type SkillPackCandidate
} from "../../../src/core/promotion/skill-pack.js";
import { readPromotedSkillPacks } from "../../../src/skill-packs/promoted.js";
```

```ts
// (파일 하단에 추가)
async function freshA() {
  const dir = await mkdtemp(join(tmpdir(), "spp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return new FsArtifact({ cwd: dir });
}
const spCand: SkillPackCandidate = { id: "sp1", appliesTo: "X", guidance: ["g1"], submittedAt: "t0" };

test("submitSkillPack: skill-pack.json + ledger", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  const saved = await a.readJson<SkillPackCandidate>("promotions/sp1/skill-pack.json");
  assert.equal(saved?.id, "sp1");
  const led = await a.readMarkdown("promotions/ledger.jsonl");
  assert.match(led ?? "", /"action":"submit"/);
});

test("approveSkillPack: promoted-skill-packs.json 봉인 + approvalHash", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  const { entry } = await approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t1" });
  assert.ok(entry.approvalHash.length === 64);
  const m = await readPromotedSkillPacks(a);
  assert.equal(m.packs[0]!.id, "sp1");
});

test("approveSkillPack: 후보 없으면 throw", async () => {
  const a = await freshA();
  await assert.rejects(() => approveSkillPack(a, "nope", { approvedBy: "me", clockNow: "t1" }));
});

test("approveSkillPack: 이미 채용된 id 면 throw", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  await approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t1" });
  await submitSkillPack(a, { ...spCand, submittedAt: "t2" });
  await assert.rejects(() => approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t3" }));
});

test("rejectSkillPack: decision rejected + ledger", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  await rejectSkillPack(a, "sp1", "별로", "t1");
  const d = await a.readJson<{ verdict: string }>("promotions/sp1/decision.json");
  assert.equal(d?.verdict, "rejected");
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/skill-pack.test.ts`
Expected: FAIL — submit/approve/reject export 없음.

- [ ] **Step 4: 구현**

`src/core/promotion/skill-pack.ts` 에 추가(상단 import + 함수). 상단 import 추가:

```ts
import type { FsArtifact } from "../../artifact/fs-artifact.js";
import { canonicalHash } from "../../utils/integrity.js";
import { appendLedger } from "./store.js";
import {
  readPromotedSkillPacks, writePromotedSkillPacks, type PromotedSkillPackEntry
} from "../../skill-packs/promoted.js";
import type { PromotionDecisionRecord } from "./store-types.js";
```

함수 추가(파일 하단):

```ts
export async function submitSkillPack(artifact: FsArtifact, cand: SkillPackCandidate): Promise<void> {
  await artifact.writeJson(`promotions/${cand.id}/skill-pack.json`, cand);
  await appendLedger(artifact, { action: "submit", id: cand.id, at: cand.submittedAt });
}

export interface ApproveSkillPackOptions { approvedBy: string; clockNow: string; }

/** 사람 승인 → promoted-skill-packs.json 봉인 + decision + ledger. 점수화 없음(사람 게이트). */
export async function approveSkillPack(
  artifact: FsArtifact,
  id: string,
  opts: ApproveSkillPackOptions
): Promise<{ entry: PromotedSkillPackEntry }> {
  const cand = await artifact.readJson<SkillPackCandidate>(`promotions/${id}/skill-pack.json`);
  if (!cand) {
    const e = new Error(`approve-pack: ${id} 후보 없음 — submit-pack 먼저`);
    (e as Error & { exitCode?: number }).exitCode = 4;
    throw e;
  }
  const manifest = await readPromotedSkillPacks(artifact);
  if (manifest.packs.some((p) => p.id === cand.id)) {
    const e = new Error(`approve-pack: ${cand.id} 이미 채용됨`);
    (e as Error & { exitCode?: number }).exitCode = 4;
    throw e;
  }
  const approvalHash = canonicalHash(cand);
  const entry: PromotedSkillPackEntry = {
    id: cand.id, appliesTo: cand.appliesTo, guidance: cand.guidance,
    promotedAt: opts.clockNow, approvalHash,
    ...(cand.experiences && cand.experiences.length > 0 ? { experiences: cand.experiences } : {})
  };
  manifest.packs.push(entry);
  await writePromotedSkillPacks(artifact, manifest);
  const decision: PromotionDecisionRecord = {
    verdict: "approved", approvedBy: opts.approvedBy, approvalHash, decidedAt: opts.clockNow
  };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "approve", id, verdict: "approved", at: opts.clockNow });
  return { entry };
}

export async function rejectSkillPack(
  artifact: FsArtifact, id: string, reason: string, clockNow: string
): Promise<void> {
  const decision: PromotionDecisionRecord = { verdict: "rejected", reason, decidedAt: clockNow };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "reject", id, verdict: "rejected", at: clockNow });
}
```

- [ ] **Step 5: 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/skill-pack.test.ts`
Then: `node --test --import tsx tests/unit/promotion/store.test.ts` (appendLedger export 회귀)
Expected: PASS (skill-pack: 4+5=9; store 7).

- [ ] **Step 6: 커밋**

```bash
git add src/core/promotion/store.ts src/core/promotion/skill-pack.ts tests/unit/promotion/skill-pack.test.ts
git commit -m "feat(promotion): submit/approve/reject skill-pack + ledger 공유(appendLedger export)"
```

---

## Task 4: 최소 가시성 — enable/status 가 promoted 인식

**Files:**
- Modify: `src/skill-packs/index.ts`
- Test: `tests/unit/skill-packs/promoted-visibility.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// tests/unit/skill-packs/promoted-visibility.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../../src/core/stage-runner.js";
import { enableSkillPack, getSkillPackStatus } from "../../../src/skill-packs/index.js";

async function depsWithPromoted() {
  const dir = await mkdtemp(join(tmpdir(), "spv-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  const deps = buildDeps(dir);
  await deps.artifact.writeJson("promoted-skill-packs.json", {
    packs: [{ id: "promo-x", appliesTo: "X", guidance: ["g"], promotedAt: "t", approvalHash: "h" }]
  });
  return deps;
}

test("enableSkillPack: 채용된 promoted pack 도 enable 가능(unknown 아님)", async () => {
  const deps = await depsWithPromoted();
  const next = await enableSkillPack("promo-x", deps);
  assert.ok(next.enabledPacks.includes("promo-x"));
});

test("getSkillPackStatus: 채용된 pack 을 unknown 으로 오인 안 함", async () => {
  const deps = await depsWithPromoted();
  await enableSkillPack("promo-x", deps);
  const status = await getSkillPackStatus(deps);
  assert.equal(status.unknownEnabled.includes("promo-x"), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted-visibility.test.ts`
Expected: FAIL — enableSkillPack 이 promoted 모름 → `unknown skill pack: promo-x` throw.

- [ ] **Step 3: 구현**

`src/skill-packs/index.ts` 상단 import 에 추가:

```ts
import { loadPromotedSkillPackIds } from "./promoted.js";
```

`enableSkillPack` 의 unknown 검사 교체 — 기존:

```ts
  if (!findSkillPack(packId)) {
    throw new SkillPackError(`unknown skill pack: ${packId}`);
  }
```

교체:

```ts
  if (!findSkillPack(packId) && !(await loadPromotedSkillPackIds(deps.artifact)).has(packId)) {
    throw new SkillPackError(`unknown skill pack: ${packId}`);
  }
```

`getSkillPackStatus` 의 unknown 계산 교체 — 기존:

```ts
  const unknown = r.enabledPacks.filter((p) => !findSkillPack(p));
```

교체:

```ts
  const promotedIds = await loadPromotedSkillPackIds(deps.artifact);
  const unknown = r.enabledPacks.filter((p) => !findSkillPack(p) && !promotedIds.has(p));
```

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/unit/skill-packs/promoted-visibility.test.ts`
Then: `node --test --import tsx tests/unit/skill-packs/*.test.ts` (skill-pack 회귀)
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/skill-packs/index.ts tests/unit/skill-packs/promoted-visibility.test.ts
git commit -m "feat(skill-packs): enable/status 가 promoted skill-pack 인식(최소 가시성)"
```

---

## Task 5: promote CLI — submit-pack/approve-pack/reject-pack/list-packs

**Files:**
- Modify: `src/cli/commands/promote.ts`
- Test: `tests/integration/promote-cli.test.ts` (추가)

- [ ] **Step 1: 추가 실패 테스트**

`tests/integration/promote-cli.test.ts` **하단**에 추가(상단 import 는 P2 에서 mkdtemp/mkdir/writeFile/readFile/tmpdir 이미 있음):

```ts
test("submit-pack: 유효 JSON → skill-pack.json 기록", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "pack.json");
  await writeFile(packFile, JSON.stringify({ id: "ui-extra", appliesTo: "UI", guidance: ["use aria-label"] }));
  const r = run(["--workspace", ws, "promote", "submit-pack", "ui-extra", "--pack-file", packFile]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cand = JSON.parse(await readFile(join(ws, ".harness", "promotions", "ui-extra", "skill-pack.json"), "utf8")) as { id: string };
  assert.equal(cand.id, "ui-extra");
});

test("submit-pack: 잘못된 JSON(guidance 누락) → exit 4", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "bad.json");
  await writeFile(packFile, JSON.stringify({ id: "bad", appliesTo: "UI" }));
  const r = run(["--workspace", ws, "promote", "submit-pack", "bad", "--pack-file", packFile]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /INVALID_SKILL_PACK|guidance/);
});

test("approve-pack → list-packs 에 표시", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "pack.json");
  await writeFile(packFile, JSON.stringify({ id: "ui-extra", appliesTo: "UI", guidance: ["g"] }));
  run(["--workspace", ws, "promote", "submit-pack", "ui-extra", "--pack-file", packFile]);
  const a = run(["--workspace", ws, "promote", "approve-pack", "ui-extra", "--approved"]);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  const l = run(["--workspace", ws, "promote", "list-packs"]);
  assert.match(l.stdout + l.stderr, /ui-extra/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Expected: FAIL — submit-pack 등 미등록(unknown command).

- [ ] **Step 3: 구현**

`src/cli/commands/promote.ts` 상단 import 에 추가:

```ts
import { readFile as readFileP } from "node:fs/promises";
import { SKILL_PACK_CATALOG, type SkillPackDef } from "../../skill-packs/catalog.js";
import {
  validateSkillPackCandidate, submitSkillPack, approveSkillPack, rejectSkillPack,
  type SkillPackCandidate
} from "../../core/promotion/skill-pack.js";
import { readPromotedSkillPacks } from "../../skill-packs/promoted.js";
```

`registerPromote` 안, 기존 `list` 서브커맨드 등록 다음에 추가:

```ts
  cmd.command("submit-pack")
    .description("skill-pack 후보 제출 (JSON 파일 + 사람 검토 승격)")
    .argument("<id>", "promotion id")
    .requiredOption("--pack-file <path>", "SkillPackDef JSON ({id, appliesTo, guidance[]})")
    .option("--experience <id>", "동기가 된 eval-case id (반복 가능)", (v: string, prev: string[]) => prev.concat([v]), [] as string[])
    .action(async (id: string, o: { packFile: string; experience: string[] }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const raw = JSON.parse(await readFileP(resolve(o.packFile), "utf8")) as Partial<SkillPackDef>;
        const builtinIds = new Set(SKILL_PACK_CATALOG.map((p) => p.id));
        const v = validateSkillPackCandidate(raw, builtinIds);
        if (!v.ok) { const e = new Error(`INVALID_SKILL_PACK: ${v.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const experiences = [...new Set(o.experience)];
        // P2 validateExperiences 재사용(스펙 §1.4) — 없는/룰무관 eval-case 참조 차단.
        const expCheck = await validateExperiences(experiences, (eid) => deps.artifact.readJson<{ kind: string }>(`eval-cases/${eid}.json`));
        if (!expCheck.ok) { const e = new Error(`INVALID_EXPERIENCE: ${expCheck.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const cand: SkillPackCandidate = {
          id, appliesTo: raw.appliesTo!, guidance: raw.guidance!, submittedAt: isoNow(),
          ...(experiences.length > 0 ? { experiences } : {})
        };
        await submitSkillPack(deps.artifact, cand);
        return id;
      }, (id) => console.error(`[ok] skill-pack submitted: ${id}`));
    });

  cmd.command("approve-pack")
    .description("사람 승인 → skill-pack 카탈로그 채용(promoted-skill-packs.json) + ledger")
    .argument("<id>", "promotion id")
    .requiredOption("--approved", "명시 승인 도장")
    .option("--by <who>", "승인자", "local")
    .action(async (id: string, o: { by: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const { entry } = await approveSkillPack(deps.artifact, id, { approvedBy: o.by, clockNow: isoNow() });
        return entry.id;
      }, (pid) => console.error(`[ok] approved skill-pack: ${pid} (promoted-skill-packs.json + ledger)`));
    });

  cmd.command("reject-pack")
    .description("명시 거절 → rejected 기록")
    .argument("<id>", "promotion id")
    .option("--reason <text>", "사유", "rejected by human")
    .action(async (id: string, o: { reason: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        await rejectSkillPack(deps.artifact, id, o.reason, isoNow());
        return id;
      }, (id) => console.error(`[ok] rejected skill-pack: ${id}`));
    });

  cmd.command("list-packs")
    .description("채용된 skill-pack 목록(promoted-skill-packs.json)")
    .action(async () => {
      await runStage(async () => {
        const deps = buildDeps();
        return (await readPromotedSkillPacks(deps.artifact)).packs;
      }, (packs) => {
        if (packs.length === 0) console.error("(채용 skill-pack 없음)");
        for (const p of packs) console.error(`- ${p.id} (${p.appliesTo}) @${p.promotedAt}${p.experiences?.length ? ` exp=[${p.experiences.join(",")}]` : ""}`);
      });
    });
```

> 메모: `resolve`/`isoNow`/`buildDeps`/`runStage` import 는 promote.ts 상단에 이미 있다. `readFile` 은 P1b 에서 `readFile`(readdir 용)로 이미 import 되어 있으므로 충돌 회피 위해 신규 import 는 `readFile as readFileP` 별칭 사용.

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Then: `node --test --import tsx tests/integration/cli-help.test.ts` ("28 commands" 단언은 promote 서브커맨드라 불변 — 최상위 명령 수 안 늘어남, 회귀만 확인)
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/cli/commands/promote.ts tests/integration/promote-cli.test.ts
git commit -m "feat(promote): skill-pack 서브커맨드 submit-pack/approve-pack/reject-pack/list-packs"
```

---

## Task 6: 전체 회귀 + CLI 스모크 + 문서

**Files:**
- Modify: `docs/PROMOTION-GATE.md`
- Verify only: 전체

- [ ] **Step 1: 전체 verify**

Run: `npm run verify`
Expected: 0 exit. depcheck 0 (skill-packs→artifact, core/promotion→skill-packs 는 금지 규칙 없음). 전체 GREEN (P2 415 + 신규: promoted 2 + skill-pack 9 + visibility 2 + promote-cli 3 = 431).

- [ ] **Step 2: CLI 스모크** (PowerShell, BOM 없는 JSON 작성에 주의 — `[System.IO.File]::WriteAllText` 사용)

```powershell
$ws = Join-Path $env:TEMP ("p3smoke-" + [System.Guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force -Path (Join-Path $ws ".harness") | Out-Null
[System.IO.File]::WriteAllText((Join-Path $ws "pack.json"), '{"id":"ui-extra","appliesTo":"UI","guidance":["use aria-label","focus ring 명시"]}')
$cli = "src/cli/index.ts"
node --import tsx $cli --workspace $ws promote submit-pack ui-extra --pack-file (Join-Path $ws "pack.json")
node --import tsx $cli --workspace $ws promote approve-pack ui-extra --approved
node --import tsx $cli --workspace $ws promote list-packs
node --import tsx $cli --workspace $ws skill-pack enable ui-extra
```

Expected: submit/approve ok(exit 0), list-packs 에 `ui-extra`, skill-pack enable 성공(unknown 아님).

- [ ] **Step 3: 문서** — `docs/PROMOTION-GATE.md` §3 표의 P3 행 마지막 셀 갱신.

기존:

```text
| 어려움 | **P3(후속)** |
```

교체:

```text
| 어려움 | **P3 ✅구현**(사람검토 승격: submit-pack/approve-pack, promoted-skill-packs.json+ledger 봉인, render 주입은 render 배선 시 후속) |
```

- [ ] **Step 4: 최종 verify + 커밋**

Run: `npm run verify`
Expected: 0 exit, 전체 GREEN.

```bash
git add docs/PROMOTION-GATE.md
git commit -m "docs(promotion): §3 P3 (skill-pack 사람검토 승격) 구현 표기"
```

---

## P3 완료 기준 (Definition of Done)

- `npm run verify` 0 exit, depcheck 위반 0.
- `submit-pack → approve-pack` 가 promoted-skill-packs.json + ledger + decision 을 만들고 approvalHash 봉인.
- 잘못된 pack(필드 누락/빈 guidance/builtin 충돌) → exit 4. 중복 채용·후보 없음 → 거부.
- 채용된 pack 이 `skill-pack enable` 로 활성화되고 status 가 "unknown" 으로 오인 안 함.
- `promote list-packs` 가 채용 pack(+experiences) 표시.
- 회귀 0: 기존 promotion·skill-pack·gate green.

## 후속 (P3 밖)

- render(워커 guidance 주입)가 실제 배선될 때 promoted pack 합류.
- skill-pack 버전 관리/diff.
