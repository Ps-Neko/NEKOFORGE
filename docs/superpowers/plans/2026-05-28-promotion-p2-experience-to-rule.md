# Promotion Gate P2 — experience → rule (얇은 provenance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P1b 승격 엔진을 그대로 재사용하면서, 후보 rule 에 동기가 된 경험(eval-case)을 `--experience` 로 선택 링크·검증·봉인하는 provenance 계층을 추가한다.

**Architecture:** 신규 채점·verdict·eval-case 스키마 변경·코드 자동생성 없음. `CandidateDef`/`PromotedRuleEntry` 에 `experiences?: string[]` 추가 + 순수 검증 함수 `validateExperiences`(주입형 reader) + `promote submit --experience`(반복) + approve 시 candidate→promoted 복사(봉인). `--experience` 미지정 시 P1b 동작 불변.

**Tech Stack:** TypeScript 5.7 (ESM, import 경로 `.js` 접미사 필수), `node:test` + `tsx`, `commander`. 순수 함수 + 주입형 의존으로 테스트.

**경로 주의:** `C:/Users/Mun/NEKOFORGE` 기준. 브랜치 `feat/promotion-p2-experience` (스펙 `271513d` 위).

**설계 출처:** `docs/superpowers/specs/2026-05-28-promotion-p2-experience-to-rule-design.md`.

---

## File Structure

- **Modify** `src/core/promotion/store-types.ts` — `CandidateDef`/`PromotedRuleEntry` 에 `experiences?: string[]`.
- **Create** `src/core/promotion/experience.ts` — `RULE_RELATED_KINDS`, `EvalCaseReader`, `validateExperiences`.
- **Modify** `src/core/promotion/store.ts` — `approveCandidate` 가 `experiences` 를 `PromotedRuleEntry` 에 복사.
- **Modify** `src/cli/commands/promote.ts` — `submit --experience`(반복) 검증·기록 + `list` 출처 표시.
- **Test** `tests/unit/promotion/experience.test.ts`, `tests/unit/promotion/store.test.ts`(추가), `tests/integration/promote-cli.test.ts`(추가).
- **Modify** `docs/PROMOTION-GATE.md` — §3 P2 행 구현 표기.

각 task 는 자체로 명시된 테스트를 통과해야 한다.

---

## Task 1: experiences 필드 (store-types)

**Files:**
- Modify: `src/core/promotion/store-types.ts`

- [ ] **Step 1: CandidateDef 에 experiences 추가**

`src/core/promotion/store-types.ts` 의 `CandidateDef` 에서 `submittedAt: string;` 다음 줄에 추가:

```ts
  submittedAt: string;
  /** P2: 이 후보의 동기가 된 eval-case id 목록(provenance). 선택적. */
  experiences?: string[];
```

- [ ] **Step 2: PromotedRuleEntry 에 experiences 추가**

같은 파일 `PromotedRuleEntry` 의 `approvalHash: string;` 다음 줄에 추가:

```ts
  approvalHash: string;
  /** P2: 채용 시 봉인되는 출처 경험(candidate 에서 복사). */
  experiences?: string[];
```

- [ ] **Step 3: 타입 체크 + 커밋**

Run: `npm run typecheck`
Expected: 0 exit.

```bash
git add src/core/promotion/store-types.ts
git commit -m "feat(promotion): P2 experiences 필드 (candidate/promoted)"
```

---

## Task 2: validateExperiences (experience.ts)

**Files:**
- Create: `src/core/promotion/experience.ts`
- Test: `tests/unit/promotion/experience.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/unit/promotion/experience.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateExperiences } from "../../../src/core/promotion/experience.js";

// 주입형 reader: 맵에 있으면 { kind } 반환, 없으면 null.
function reader(map: Record<string, string>) {
  return async (id: string) => (id in map ? { kind: map[id]! } : null);
}

test("validateExperiences: 실재 + 룰 관련 kind → ok", async () => {
  const r = await validateExperiences(["e1"], reader({ e1: "missed_risk" }));
  assert.equal(r.ok, true);
});

test("validateExperiences: 없는 eval-case → ok=false + 사유", async () => {
  const r = await validateExperiences(["nope"], reader({}));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /nope|없음/);
});

test("validateExperiences: 룰 무관 kind(milestone_passed) → ok=false", async () => {
  const r = await validateExperiences(["e1"], reader({ e1: "milestone_passed" }));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /룰 관련|milestone_passed/);
});

test("validateExperiences: 다중 중 하나라도 실패 → ok=false", async () => {
  const r = await validateExperiences(["e1", "bad"], reader({ e1: "false_negative" }));
  assert.equal(r.ok, false);
});

test("validateExperiences: 5종 룰 관련 kind 모두 허용", async () => {
  for (const k of ["false_positive", "false_negative", "missed_risk", "noisy_rule", "useful_rule"]) {
    const r = await validateExperiences(["e"], reader({ e: k }));
    assert.equal(r.ok, true, `kind ${k} 는 허용돼야 함`);
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/experience.test.ts`
Expected: FAIL — `experience.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/experience.ts

/** 룰 정확성과 관련된 eval-case kind — P2 experience 참조로 유효한 종류. */
export const RULE_RELATED_KINDS: ReadonlySet<string> = new Set([
  "false_positive",
  "false_negative",
  "missed_risk",
  "noisy_rule",
  "useful_rule"
]);

/** eval-case 를 id 로 읽는 주입형 reader(테스트/실파일 양립). 없으면 null. */
export type EvalCaseReader = (id: string) => Promise<{ kind: string } | null>;

export interface ExperienceCheck {
  ok: boolean;
  reason?: string;
}

/** 참조한 eval-case 들이 실재하고 룰 관련 kind 인지 검증(provenance 위조 차단). */
export async function validateExperiences(
  ids: readonly string[],
  readEvalCase: EvalCaseReader
): Promise<ExperienceCheck> {
  for (const id of ids) {
    const ec = await readEvalCase(id);
    if (!ec) {
      return { ok: false, reason: `eval-case "${id}" 없음 — memory add 로 먼저 기록` };
    }
    if (!RULE_RELATED_KINDS.has(ec.kind)) {
      return {
        ok: false,
        reason: `eval-case "${id}" kind="${ec.kind}" 는 룰 관련 경험이 아님(유효: ${[...RULE_RELATED_KINDS].join(", ")})`
      };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/experience.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/experience.ts tests/unit/promotion/experience.test.ts
git commit -m "feat(promotion): validateExperiences — eval-case 실재+룰관련 kind 검증"
```

---

## Task 3: approve 가 experiences 봉인 (store.ts)

**Files:**
- Modify: `src/core/promotion/store.ts`
- Test: `tests/unit/promotion/store.test.ts` (추가)

- [ ] **Step 1: 추가 실패 테스트**

`tests/unit/promotion/store.test.ts` 하단(마지막 test 다음)에 추가:

```ts
test("approveCandidate: candidate.experiences 를 promoted.json 에 봉인", async () => {
  const { artifact } = await freshArtifact();
  const withExp: CandidateDef = { ...cand, experiences: ["ec-1", "ec-2"] };
  await submitCandidate(artifact, withExp);
  await artifact.writeJson("promotions/c1/trial.json", readyTrial);
  await approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" });
  const man = await readPromotedManifest(artifact);
  assert.deepEqual(man.rules[0]!.experiences, ["ec-1", "ec-2"]);
});

test("approveCandidate: experiences 없으면 entry 에 experiences 키 없음", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  await artifact.writeJson("promotions/c1/trial.json", readyTrial);
  await approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" });
  const man = await readPromotedManifest(artifact);
  assert.equal("experiences" in man.rules[0]!, false);
});
```

> 메모: `cand` 와 `readyTrial`, `freshArtifact`, `CandidateDef` import 는 기존 store.test.ts 상단에 이미 있다(추가 import 불필요).

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/store.test.ts`
Expected: FAIL — "봉인" 테스트가 `man.rules[0].experiences` undefined 로 실패(아직 복사 안 함).

- [ ] **Step 3: 구현**

`src/core/promotion/store.ts` 의 `approveCandidate` 안에서 `entry` 생성부를 교체:

```ts
  const entry: PromotedRuleEntry = {
    id: cand.id, modulePath: cand.modulePath, exportName: cand.exportName,
    promotedAt: opts.clockNow, approvalHash,
    ...(cand.experiences && cand.experiences.length > 0 ? { experiences: cand.experiences } : {})
  };
```

> 나머지 approveCandidate 로직(PROMOTE_READY 검사, approvalHash, manifest push, ledger)은 불변.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/store.test.ts`
Expected: PASS (기존 5 + 신규 2 = 7 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/store.ts tests/unit/promotion/store.test.ts
git commit -m "feat(promotion): approve 가 candidate.experiences 를 promoted.json 에 봉인"
```

---

## Task 4: promote submit --experience + list 표시 (CLI)

**Files:**
- Modify: `src/cli/commands/promote.ts`
- Test: `tests/integration/promote-cli.test.ts` (추가)

- [ ] **Step 1: 추가 실패 테스트(통합)**

먼저 `tests/integration/promote-cli.test.ts` **상단 import 블록**(기존 마지막 import 다음)에 2줄 추가:

```ts
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
```

그다음 같은 파일 **하단**(기존 마지막 `test(...)` 다음)에 헬퍼 + 테스트 추가:

```ts
async function wsWithEvalCase(kind: string): Promise<{ ws: string; ecId: string }> {
  const ws = await mkdtemp(join(tmpdir(), "p2-"));
  await mkdir(join(ws, ".harness", "eval-cases"), { recursive: true });
  const ecId = "ec-test-1";
  await writeFile(
    join(ws, ".harness", "eval-cases", `${ecId}.json`),
    JSON.stringify({ id: ecId, kind, summary: "test case" })
  );
  return { ws, ecId };
}
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("submit --experience: 유효 eval-case 면 candidate.json 에 기록", async () => {
  const { ws, ecId } = await wsWithEvalCase("missed_risk");
  const r = run([
    "--workspace", ws, "promote", "submit", "r1",
    "--module", join(repoRoot, "src/rules/promotion-candidates/todo-comment-risk.ts"),
    "--export", "todoCommentRiskRule",
    "--fixtures", join(repoRoot, "fixtures"),
    "--experience", ecId
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cand = JSON.parse(await readFile(join(ws, ".harness", "promotions", "r1", "candidate.json"), "utf8")) as { experiences?: string[] };
  assert.deepEqual(cand.experiences, [ecId]);
});

test("submit --experience: 없는 eval-case 면 exit != 0", async () => {
  const { ws } = await wsWithEvalCase("missed_risk");
  const r = run([
    "--workspace", ws, "promote", "submit", "r2",
    "--module", join(repoRoot, "src/rules/promotion-candidates/todo-comment-risk.ts"),
    "--export", "todoCommentRiskRule",
    "--fixtures", join(repoRoot, "fixtures"),
    "--experience", "does-not-exist"
  ]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /INVALID_EXPERIENCE|없음/);
});
```

> 기존 `run(args)` 헬퍼(spawnSync process.execPath + tsx + cli)와 `join`/`dirname`/`fileURLToPath` import 는 파일 상단에 이미 있다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Expected: FAIL — `--experience` 옵션 미지원(candidate.json 에 experiences 없음 / 없는 eval-case 도 통과).

- [ ] **Step 3: 구현**

`src/cli/commands/promote.ts` 상단 import 에 추가:

```ts
import { validateExperiences } from "../../core/promotion/experience.js";
```

`submit` 서브커맨드의 옵션에 `--experience` 추가(`.requiredOption("--fixtures ...")` 다음 줄):

```ts
    .option("--experience <id>", "동기가 된 eval-case id (반복 가능)", (v: string, prev: string[]) => prev.concat([v]), [] as string[])
```

`submit` 의 `.action` 시그니처와 본문을 교체:

```ts
    .action(async (id: string, o: { module: string; export: string; fixtures: string; experience: string[] }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const experiences = [...new Set(o.experience)];
        const expCheck = await validateExperiences(
          experiences,
          (eid) => deps.artifact.readJson<{ kind: string }>(`eval-cases/${eid}.json`)
        );
        if (!expCheck.ok) { const e = new Error(`INVALID_EXPERIENCE: ${expCheck.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const cand: CandidateDef = {
          id, kind: "rule", modulePath: resolve(o.module), exportName: o.export, submittedAt: isoNow(),
          ...(experiences.length > 0 ? { experiences } : {})
        };
        const { files, verdicts } = await readFixtures(resolve(o.fixtures));
        const min = validateMinFixtures(verdicts);
        if (!min.ok) { const e = new Error(`INSUFFICIENT_EVIDENCE: ${min.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        await submitCandidate(deps.artifact, cand);
        await deps.artifact.writeJson(`promotions/${id}/fixtures-hash.json`, {
          fixturesHash: computeFixturesHash(cand, files)
        });
        return id;
      }, (id) => console.error(`[ok] submitted: ${id}`));
    });
```

`list` 서브커맨드의 출력 줄에 출처 표시 추가 — 기존:

```ts
        for (const r of rules) console.error(`- ${r.id} (${r.modulePath}#${r.exportName}) @${r.promotedAt}`);
```

교체:

```ts
        for (const r of rules) console.error(`- ${r.id} (${r.modulePath}#${r.exportName}) @${r.promotedAt}${r.experiences?.length ? ` exp=[${r.experiences.join(",")}]` : ""}`);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Then: `node --test --import tsx tests/unit/promotion/candidate.test.ts` (회귀 — submit 다른 인자 불변)
Expected: PASS (promote-cli: 기존 1 + 신규 2 = 3).

- [ ] **Step 5: 커밋**

```bash
git add src/cli/commands/promote.ts tests/integration/promote-cli.test.ts
git commit -m "feat(promote): submit --experience 검증·기록 + list 출처 표시"
```

---

## Task 5: 전체 회귀 + CLI 스모크 + 문서

**Files:**
- Modify: `docs/PROMOTION-GATE.md`
- Verify only: 전체

- [ ] **Step 1: 전체 verify**

Run: `npm run verify`
Expected: 0 exit. typecheck/lint/depcheck 0, 전체 테스트 GREEN (P1b 후속 하드닝 406 + 신규: experience 5 + store 2 + promote-cli 2 = 415).

- [ ] **Step 2: CLI 엔드투엔드 스모크**

임시 workspace 에서 (PowerShell):

```powershell
$ws = Join-Path $env:TEMP ("p2smoke-" + [System.Guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force -Path (Join-Path $ws ".harness\eval-cases") | Out-Null
Set-Content -Path (Join-Path $ws ".harness\eval-cases\ec1.json") -Value '{"id":"ec1","kind":"missed_risk","summary":"smoke"}' -Encoding utf8
$cli = "src/cli/index.ts"
node --import tsx $cli --workspace $ws promote submit r1 --module src/rules/promotion-candidates/todo-comment-risk.ts --export todoCommentRiskRule --fixtures fixtures --experience ec1
node --import tsx $cli --workspace $ws promote submit rbad --module src/rules/promotion-candidates/todo-comment-risk.ts --export todoCommentRiskRule --fixtures fixtures --experience nope
```

Expected: r1 = `[ok] submitted: r1`(exit 0), rbad = `INVALID_EXPERIENCE`(exit 4).

- [ ] **Step 3: 문서 동기화** — `docs/PROMOTION-GATE.md` §3 표의 P2 행에 구현 표기.

기존(§3 표):

```text
| **② 경험 → rule** | memory 의 미탐/오탐 사례에서 유도한 rule 후보 | 경험 사례를 fixture 로 변환 → ① 의 채점 재사용 | 중간 | **P2** |
```

교체:

```text
| **② 경험 → rule** | memory 의 미탐/오탐 사례에서 유도한 rule 후보 | fixture 는 promote 시 제출(P1b 재사용), eval-case 는 `--experience` provenance 링크 | 중간 | **P2 ✅구현** |
```

- [ ] **Step 4: 최종 verify + 커밋**

Run: `npm run verify`
Expected: 0 exit, 전체 GREEN.

```bash
git add docs/PROMOTION-GATE.md
git commit -m "docs(promotion): §3 P2 (experience provenance) 구현 표기"
```

---

## P2 완료 기준 (Definition of Done)

- `npm run verify` 0 exit, depcheck 위반 0.
- `promote submit ... --experience <id>` 가 eval-case 실재+룰관련 kind 검증 후 candidate.json 에 provenance 기록. 잘못된 참조는 exit 4.
- `approve` 가 experiences 를 promoted.json 에 봉인. `--experience` 없으면 entry 에 키 없음(P1b 불변).
- `promote list` 가 출처 경험 표시.
- 회귀 0: 기존 promotion·gate·e2e green 유지.

## 후속 (P2 밖)

- P3(skill-pack) — 간접 신호 + 사람 검토(PROMOTION-GATE §3).
- 경험↔fixture 시나리오 자동 링크(현재 수동, YAGNI 로 보류).
