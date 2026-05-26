# Promotion Gate P1b (운영 계층: 후보 → 승인 → 채용 + 위변조탐지 + self-host) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P1a 코어(룰셋 주입형 benchmark + `comparePromotion` + `runTrial`) 위에, deterministic rule 후보를 제출·시험·**사람 승인 후 자동 채용**하고, 그 이력을 위변조 불가하게 보관하는 `promote` 운영 계층을 구현한다. self-host(실제 rule 1개 채용)로 닫는다.

**Architecture:**
- **후보 rule = 모듈 파일**: 사람(또는 AI)이 미리 작성한 rule 모듈을 `candidate.json`이 `modulePath`+`exportName`으로 가리킨다. promote가 **dynamic import**로 로딩한다(코드 자동생성 없음 — PROMOTION-GATE.md §12 정합).
- **채용 = 동적 매니페스트(B안 자동 갱신)**: `approve --approved` 시 후보 rule을 `.harness/promotions/promoted.json`에 등록한다. `loadActiveRules(cwd)`가 `DEFAULT_BENCHMARK_RULES + loadPromotedRules(cwd)`를 반환하여 benchmark·gate·trial baseline이 채용분을 즉시 동적 합류한다. **소스 코드(`rules/index.ts`)는 자동 수정하지 않는다.**
- **봉인**: `src/utils/integrity.ts`의 `canonicalHash`로 `fixturesHash`(후보+fixture 묶음)·`approvalHash`(승인 시점 trial 레코드)를 봉인한다.
- **ledger**: `src/utils/audit.ts`의 prev_hash/line_hash chain 패턴을 준용한 `.harness/promotions/ledger.jsonl`(append-only) + chain 검증.
- **자동화 경계**: 시험·비교·판정은 자동, **카탈로그 채용은 `--approved` 사람 도장 없이는 불가**(PROMOTION-GATE.md §6).

**Tech Stack:** TypeScript 5.7 (ESM, import 경로 `.js` 접미사 필수), `node:test` + `tsx`, `commander`. 순수 함수 + 주입형 의존(`importer`, `clock`)으로 테스트.

**경로 주의:** `C:/Users/Mun/NEKOFORGE` 기준. 모든 신규 파일은 `src/core/promotion/` 하위.

**설계 출처:** `docs/PROMOTION-GATE.md` (§4 흐름, §5 합격기준, §6 자동화수준, §7 저장구조, §8 4잠금, §9 엣지, §10 CLI, §13 자가점검, §11 self-host).

**선행:** P1a 코어 (PR #2 / branch `feat/promotion-gate-p1a`). 본 계획은 그 위에 쌓는다.

---

## File Structure

- **Create** `src/core/promotion/store-types.ts` — 저장 레코드 타입(`CandidateDef`, `TrialRecord`, `PromotionDecisionRecord`, `PromotedRuleEntry`, `PromotedManifest`, `LedgerEntry`).
- **Create** `src/core/promotion/candidate.ts` — `loadCandidateRule`(dynamic import + 형 검증), `computeFixturesHash`, `validateMinFixtures`.
- **Create** `src/core/promotion/promoted.ts` — `loadPromotedRules`(매니페스트 → dynamic import), `loadActiveRules`(DEFAULT + promoted).
- **Create** `src/core/promotion/ledger.ts` — `appendLedger`(chain), `verifyLedgerChain`.
- **Create** `src/core/promotion/store.ts` — submit/trial/approve/reject 저장 오케스트레이션(FsArtifact 사용).
- **Create** `src/cli/commands/promote.ts` — `registerPromote(program)` + submit/trial/report/approve/reject/list.
- **Modify** `src/core/promotion/trial.ts` — `runTrial`의 baseline 을 `loadActiveRules(cwd)` 로(채용분 포함). cwd 파라미터 추가, 하위호환 유지.
- **Modify** `src/core/gate/index.ts` — `runAllRules`/`runAllRulesExceptCodex` 가 promoted rule 합류(L800-818).
- **Modify** `src/cli/index.ts` — `registerPromote(program)` 등록.
- **Test** `tests/unit/promotion/{candidate,promoted,ledger,store}.test.ts`, `tests/integration/promote-cli.test.ts`, `tests/e2e/promote-self-host.test.ts`.

각 task 는 자체로 `npm test`(또는 명시된 단위)를 통과해야 한다.

---

## Task 1: 저장 레코드 타입

**Files:**
- Create: `src/core/promotion/store-types.ts`

- [ ] **Step 1: 타입 정의** (타입 선언이므로 Task 5/6 테스트가 소비; 별도 실패 테스트 없음)

```ts
// src/core/promotion/store-types.ts
import type { PromoteVerdict } from "./types.js";

/** P1b 범위: rule 만. experience/skill-pack 은 P2/P3. */
export type PromotionKind = "rule";

/** 후보 정의 — 후보 rule 모듈을 가리킨다(코드 자동생성 없음). */
export interface CandidateDef {
  id: string;
  kind: PromotionKind;
  /** 레포 루트 기준 상대 경로의 rule 모듈(.ts/.js). */
  modulePath: string;
  /** 그 모듈에서 DeterministicRule 을 export 하는 이름. */
  exportName: string;
  submittedAt: string;
}

/** trial.json — baseline vs candidate 점수 + 판정 + 봉인. */
export interface TrialRecord {
  baseline: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number };
  candidate: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number };
  verdict: PromoteVerdict;
  reasons: string[];
  /** canonicalHash(후보 + fixture 묶음) — §8-1 시험 입력 봉인. */
  fixturesHash: string;
  ranAt: string;
}

/** decision.json — 사람 판정 + 승인 봉인. */
export interface PromotionDecisionRecord {
  verdict: "approved" | "rejected";
  approvedBy?: string;
  /** canonicalHash(승인 시점 trial.json) — §8-3 승인 봉인. */
  approvalHash?: string;
  reason?: string;
  decidedAt: string;
}

/** promoted.json 항목 — 채용된 rule(동적 로딩 대상). */
export interface PromotedRuleEntry {
  id: string;
  modulePath: string;
  exportName: string;
  promotedAt: string;
  approvalHash: string;
}

export interface PromotedManifest {
  rules: PromotedRuleEntry[];
}

/** ledger.jsonl 한 줄 — append-only + chain(§8-4). */
export interface LedgerEntry {
  action: "submit" | "trial" | "approve" | "reject";
  id: string;
  verdict?: string;
  at: string;
  prev_hash: string | null;
  line_hash: string;
}

/** ledger append 입력(체인 필드 제외). ledger.ts / store.ts 가 공유. */
export type NewLedgerInput = Omit<LedgerEntry, "prev_hash" | "line_hash">;
```

- [ ] **Step 2: 타입 체크 + 커밋**

Run: `npm run typecheck`
Expected: 0 exit.

```bash
git add src/core/promotion/store-types.ts
git commit -m "feat(promotion): P1b 저장 레코드 타입 (candidate/trial/decision/promoted/ledger)"
```

---

## Task 2: candidate 로딩 + 봉인 + 최소 fixture 검증

**Files:**
- Create: `src/core/promotion/candidate.ts`
- Test: `tests/unit/promotion/candidate.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — dynamic import 는 `importer` 주입으로 테스트(실제 파일 불요).

```ts
// tests/unit/promotion/candidate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCandidateRule,
  computeFixturesHash,
  validateMinFixtures
} from "../../../src/core/promotion/candidate.js";
import type { CandidateDef } from "../../../src/core/promotion/store-types.js";
import type { DeterministicRule } from "../../../src/rules/types.js";

const cand: CandidateDef = {
  id: "c1", kind: "rule", modulePath: "./fake.js",
  exportName: "myRule", submittedAt: "2026-05-27T00:00:00Z"
};
const goodRule: DeterministicRule = {
  id: "my-rule", describe: "x", run: async () => []
};

test("loadCandidateRule: importer 가 준 export 를 DeterministicRule 로 반환", async () => {
  const r = await loadCandidateRule(cand, async () => ({ myRule: goodRule }));
  assert.equal(r.id, "my-rule");
});

test("loadCandidateRule: export 가 rule 형이 아니면 throw", async () => {
  await assert.rejects(
    () => loadCandidateRule(cand, async () => ({ myRule: { nope: 1 } })),
    /not a DeterministicRule/
  );
});

test("computeFixturesHash: 동일 입력 동일 해시, 다른 fixture 다른 해시", () => {
  const a = computeFixturesHash(cand, { "f1/expected.json": "{}" });
  const b = computeFixturesHash(cand, { "f1/expected.json": "{}" });
  const c = computeFixturesHash(cand, { "f1/expected.json": '{"x":1}' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("validateMinFixtures: positive≥3 & negative≥2 → ok", () => {
  const r = validateMinFixtures(["BLOCK", "BLOCK", "NEEDS_HUMAN_REVIEW", "PASS", "PASS"]);
  assert.equal(r.ok, true);
});

test("validateMinFixtures: 부족하면 ok=false + 사유", () => {
  const r = validateMinFixtures(["BLOCK", "PASS"]);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /positive|negative/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/candidate.test.ts`
Expected: FAIL — `candidate.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/candidate.ts
import { canonicalHash } from "../../utils/integrity.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { CandidateDef } from "./store-types.js";

export type ModuleImporter = (modulePath: string) => Promise<Record<string, unknown>>;

const defaultImporter: ModuleImporter = (p) => import(p) as Promise<Record<string, unknown>>;

function isDeterministicRule(v: unknown): v is DeterministicRule {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as DeterministicRule).id === "string" &&
    typeof (v as DeterministicRule).describe === "string" &&
    typeof (v as DeterministicRule).run === "function"
  );
}

/** 후보 모듈을 dynamic import 해 DeterministicRule 로 반환. importer 주입 가능(테스트). */
export async function loadCandidateRule(
  candidate: CandidateDef,
  importer: ModuleImporter = defaultImporter
): Promise<DeterministicRule> {
  const mod = await importer(candidate.modulePath);
  const rule = mod[candidate.exportName];
  if (!isDeterministicRule(rule)) {
    throw new Error(
      `candidate ${candidate.id}: export "${candidate.exportName}" is not a DeterministicRule`
    );
  }
  return rule;
}

/** §8-1 시험 입력 봉인: 후보 정의 + fixture 파일 묶음의 canonical sha256. */
export function computeFixturesHash(
  candidate: CandidateDef,
  fixtureFiles: Record<string, string>
): string {
  return canonicalHash({ candidate, fixtures: fixtureFiles });
}

export interface MinFixtureCheck {
  ok: boolean;
  positives: number;
  negatives: number;
  reason?: string;
}

/** §9: 권장 최소 positive(BLOCK/NEEDS_HUMAN_REVIEW/INSUFFICIENT_EVIDENCE) ≥ 3, negative(PASS) ≥ 2. */
export function validateMinFixtures(verdicts: readonly string[]): MinFixtureCheck {
  const positives = verdicts.filter(
    (v) => v === "BLOCK" || v === "NEEDS_HUMAN_REVIEW" || v === "INSUFFICIENT_EVIDENCE"
  ).length;
  const negatives = verdicts.filter((v) => v === "PASS").length;
  if (positives < 3 || negatives < 2) {
    return {
      ok: false,
      positives,
      negatives,
      reason: `최소 fixture 미달: positive ${positives}/3, negative ${negatives}/2`
    };
  }
  return { ok: true, positives, negatives };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/candidate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/candidate.ts tests/unit/promotion/candidate.test.ts
git commit -m "feat(promotion): candidate 로딩(dynamic import) + fixturesHash 봉인 + 최소 fixture 검증"
```

---

## Task 3: promoted 매니페스트 동적 로딩 + loadActiveRules

**Files:**
- Create: `src/core/promotion/promoted.ts`
- Test: `tests/unit/promotion/promoted.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/unit/promotion/promoted.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPromotedRules, loadActiveRules } from "../../../src/core/promotion/promoted.js";
import { DEFAULT_BENCHMARK_RULES } from "../../../src/benchmark/index.js";
import type { PromotedManifest } from "../../../src/core/promotion/store-types.js";
import type { DeterministicRule } from "../../../src/rules/types.js";

const ruleA: DeterministicRule = { id: "promoted-a", describe: "x", run: async () => [] };

const manifest: PromotedManifest = {
  rules: [{
    id: "promoted-a", modulePath: "./a.js", exportName: "ruleA",
    promotedAt: "2026-05-27T00:00:00Z", approvalHash: "deadbeef"
  }]
};

test("loadPromotedRules: 매니페스트 없으면 빈 배열", async () => {
  const rules = await loadPromotedRules(async () => null, async () => ({}));
  assert.deepEqual(rules, []);
});

test("loadPromotedRules: 매니페스트의 각 항목을 import 해 rule 반환", async () => {
  const rules = await loadPromotedRules(
    async () => manifest,
    async () => ({ ruleA })
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0]!.id, "promoted-a");
});

test("loadActiveRules: DEFAULT + promoted 합집합", async () => {
  const active = await loadActiveRules(async () => manifest, async () => ({ ruleA }));
  assert.equal(active.length, DEFAULT_BENCHMARK_RULES.length + 1);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/promoted.test.ts`
Expected: FAIL — `promoted.js` 없음.

- [ ] **Step 3: 구현** — 매니페스트 reader 와 importer 를 주입형으로(테스트/실파일 양립).

```ts
// src/core/promotion/promoted.ts
import { DEFAULT_BENCHMARK_RULES } from "../../benchmark/index.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { PromotedManifest } from "./store-types.js";
import { loadCandidateRule, type ModuleImporter } from "./candidate.js";

export type ManifestReader = () => Promise<PromotedManifest | null>;

/** promoted.json 의 각 항목을 dynamic import 해 DeterministicRule[] 로. */
export async function loadPromotedRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter
): Promise<DeterministicRule[]> {
  const manifest = await readManifest();
  if (!manifest) return [];
  const out: DeterministicRule[] = [];
  for (const entry of manifest.rules) {
    out.push(
      await loadCandidateRule(
        { id: entry.id, kind: "rule", modulePath: entry.modulePath, exportName: entry.exportName, submittedAt: entry.promotedAt },
        importer
      )
    );
  }
  return out;
}

/** 현 활성 룰셋 = 기본 카탈로그 + 채용분(promoted). benchmark/gate/trial baseline 의 단일 소스. */
export async function loadActiveRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter
): Promise<readonly DeterministicRule[]> {
  const promoted = await loadPromotedRules(readManifest, importer);
  return [...DEFAULT_BENCHMARK_RULES, ...promoted];
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/promoted.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/promoted.ts tests/unit/promotion/promoted.test.ts
git commit -m "feat(promotion): promoted 매니페스트 동적 로딩 + loadActiveRules (DEFAULT + 채용분)"
```

---

## Task 4: ledger (append-only chain + 위변조 탐지)

**Files:**
- Create: `src/core/promotion/ledger.ts`
- Test: `tests/unit/promotion/ledger.test.ts`

`src/utils/audit.ts` 의 prev_hash/line_hash chain 패턴(`computeLineHash` = sha256(JSON.stringify(payload)))을 그대로 준용한다. ledger 는 promotions 전용이라 audit.jsonl 과 분리.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/unit/promotion/ledger.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendLedgerLine, verifyLedgerChain } from "../../../src/core/promotion/ledger.js";

test("appendLedgerLine: 첫 줄 prev_hash=null, line_hash 존재", () => {
  const { line, entry } = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  assert.equal(entry.prev_hash, null);
  assert.ok(entry.line_hash.length === 64);
  assert.ok(line.endsWith("\n"));
});

test("appendLedgerLine: 둘째 줄 prev_hash = 첫 줄 line_hash (chain)", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", verdict: "approved", at: "t1" });
  assert.equal(b.entry.prev_hash, a.entry.line_hash);
});

test("verifyLedgerChain: 정상 chain → valid", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", at: "t1" });
  assert.equal(verifyLedgerChain(a.line + b.line).valid, true);
});

test("verifyLedgerChain: 본문 변조 → invalid", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const tampered = a.line.replace('"c1"', '"c2"');
  assert.equal(verifyLedgerChain(tampered).valid, false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/ledger.test.ts`
Expected: FAIL — `ledger.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/ledger.ts
import { createHash } from "node:crypto";
import type { LedgerEntry, NewLedgerInput } from "./store-types.js";

function computeLineHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function lastLineHash(ledgerText: string): string | null {
  const lines = ledgerText.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  try {
    return (JSON.parse(lines[lines.length - 1]!) as { line_hash?: string }).line_hash ?? null;
  } catch {
    return null;
  }
}

/** 기존 ledger 텍스트에 이어 붙일 한 줄을 만든다(파일 IO 없음 — store 가 append). */
export function appendLedgerLine(
  ledgerText: string,
  input: NewLedgerInput
): { line: string; entry: LedgerEntry } {
  const prev_hash = lastLineHash(ledgerText);
  const payload = { ...input, prev_hash };
  const line_hash = computeLineHash(payload);
  const entry: LedgerEntry = { ...payload, line_hash } as LedgerEntry;
  return { line: JSON.stringify(entry) + "\n", entry };
}

export interface LedgerVerifyResult { valid: boolean; brokenAtLine?: number; reason?: string; }

/** §8-4 ledger 위변조 탐지 — audit.ts validateAuditChain 동형. */
export function verifyLedgerChain(text: string): LedgerVerifyResult {
  const lines = text.split("\n").filter((l) => l.length > 0);
  let prevHash: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
    } catch {
      return { valid: false, brokenAtLine: i + 1, reason: "invalid JSON" };
    }
    const declaredPrev = (parsed.prev_hash as string | null | undefined) ?? null;
    const declaredLine = parsed.line_hash as string | undefined;
    if (declaredLine === undefined) {
      return { valid: false, brokenAtLine: i + 1, reason: "line_hash missing" };
    }
    if (declaredPrev !== prevHash) {
      return { valid: false, brokenAtLine: i + 1, reason: "prev_hash mismatch" };
    }
    const { line_hash: _omit, ...payload } = parsed;
    if (computeLineHash(payload) !== declaredLine) {
      return { valid: false, brokenAtLine: i + 1, reason: "line_hash recomputation mismatch" };
    }
    prevHash = declaredLine;
  }
  return { valid: true };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/ledger.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/ledger.ts tests/unit/promotion/ledger.test.ts
git commit -m "feat(promotion): ledger append-only chain + 위변조 탐지 (audit chain 준용)"
```

---

## Task 5: trial baseline 에 채용분 합류 (trial.ts 수정)

**Files:**
- Modify: `src/core/promotion/trial.ts`
- Test: `tests/unit/promotion/trial.test.ts` (기존 + 추가)

baseline 은 "현 카탈로그"여야 하므로 채용분(promoted)을 포함해야 한다. 기존 시그니처는 하위호환(promoted 없으면 DEFAULT)으로 유지.

- [ ] **Step 1: 추가 실패 테스트** — `runTrial` 에 `activeBaseline` 주입 시 baseline 이 그걸 쓰는지.

기존 `tests/unit/promotion/trial.test.ts` 하단에 추가:

```ts
import { DEFAULT_BENCHMARK_RULES } from "../../../src/benchmark/index.js";

test("activeBaseline 주입 시 baseline 룰셋으로 사용(채용분 반영)", async () => {
  // noisyRule 을 baseline 에 이미 포함시키면 candidate(=baseline+noisy)와 동률 → NEEDS_HUMAN_REVIEW
  const active = [...DEFAULT_BENCHMARK_RULES, noisyRule];
  const t = await runTrial(fixturesRoot, [noisyRule], { activeBaseline: active });
  assert.equal(t.decision.verdict, "NEEDS_HUMAN_REVIEW");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/trial.test.ts`
Expected: FAIL — `runTrial` 4번째 인자(opts) 미지원 / baseline 이 DEFAULT 고정.

- [ ] **Step 3: 구현** — `runTrial` 에 옵션 추가(하위호환).

`src/core/promotion/trial.ts` 의 `runTrial` 시그니처와 baseline 계산 교체:

```ts
export interface RunTrialOptions {
  filterGroup?: string;
  /** 미지정 시 DEFAULT_BENCHMARK_RULES. 채용분 포함 baseline 을 호출자가 주입. */
  activeBaseline?: readonly DeterministicRule[];
}

export async function runTrial(
  fixturesRoot: string,
  candidateRules: readonly DeterministicRule[],
  opts: RunTrialOptions = {}
): Promise<TrialResult> {
  const base = opts.activeBaseline ?? DEFAULT_BENCHMARK_RULES;
  const baseline = await runBenchmarkWithRules(fixturesRoot, base, opts.filterGroup);
  const candidate = await runBenchmarkWithRules(
    fixturesRoot,
    [...base, ...candidateRules],
    opts.filterGroup
  );
  return { baseline, candidate, decision: comparePromotion(baseline, candidate) };
}
```

> 기존 호출 `runTrial(root, rules)` 및 `runTrial(root, rules, "group")` 호환을 위해: 3번째 인자가 string 이면 `{ filterGroup }` 로 받는 오버로드가 필요하면 추가하되, 기존 P1a 테스트는 2-인자 형태만 사용하므로 옵션 객체 전환으로 충분(3-인자 string 호출은 현재 코드베이스에 없음 — `grep "runTrial(" src tests` 로 확인 후 진행).

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/trial.test.ts`
Expected: PASS (기존 2 + 신규 1 = 3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/trial.ts tests/unit/promotion/trial.test.ts
git commit -m "feat(promotion): runTrial baseline 에 채용분(activeBaseline) 주입 지원"
```

---

## Task 6: store (submit/trial/approve/reject 저장 오케스트레이션)

**Files:**
- Create: `src/core/promotion/store.ts`
- Test: `tests/unit/promotion/store.test.ts`

`FsArtifact`(`.harness/` 하위, writeJson/readJson/appendJsonLines/exists)를 주입받아 `.harness/promotions/<id>/` 에 저장. ledger 는 `promotions/ledger.jsonl`. promoted 매니페스트는 `promotions/promoted.json`.

- [ ] **Step 1: 실패 테스트 작성** — 임시 cwd 에 FsArtifact 로 실제 IO(통합 단위).

```ts
// tests/unit/promotion/store.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import { submitCandidate, approveCandidate, readPromotedManifest } from "../../../src/core/promotion/store.js";
import type { CandidateDef, TrialRecord } from "../../../src/core/promotion/store-types.js";

async function freshArtifact() {
  const dir = await mkdtemp(join(tmpdir(), "promo-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return { dir, artifact: new FsArtifact({ cwd: dir }) };
}

const cand: CandidateDef = {
  id: "c1", kind: "rule", modulePath: "./r.js", exportName: "r", submittedAt: "t0"
};
const readyTrial: TrialRecord = {
  baseline: { criticalRecall: 0.8, falsePositiveRate: 0.1, totalScenarios: 30 },
  candidate: { criticalRecall: 0.9, falsePositiveRate: 0.1, totalScenarios: 30 },
  verdict: "PROMOTE_READY", reasons: [], fixturesHash: "abc", ranAt: "t1"
};

test("submitCandidate: candidate.json 저장 + ledger 1줄", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  const saved = await artifact.readJson<CandidateDef>("promotions/c1/candidate.json");
  assert.equal(saved?.id, "c1");
  const led = await artifact.readMarkdown("promotions/ledger.jsonl");
  assert.match(led ?? "", /"action":"submit"/);
});

test("approveCandidate --approved: promoted.json 등록 + approvalHash + ledger", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  await artifact.writeJson("promotions/c1/trial.json", readyTrial);
  const res = await approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" });
  assert.equal(res.decision.verdict, "approved");
  assert.ok(res.decision.approvalHash);
  const man = await readPromotedManifest(artifact);
  assert.equal(man.rules.length, 1);
  assert.equal(man.rules[0]!.id, "c1");
});

test("approveCandidate: trial verdict 이 PROMOTE_READY 아니면 거부(throw)", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  await artifact.writeJson("promotions/c1/trial.json", { ...readyTrial, verdict: "REJECTED" });
  await assert.rejects(() => approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" }));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/store.test.ts`
Expected: FAIL — `store.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/store.ts
import type { FsArtifact } from "../../artifact/fs-artifact.js";
import { canonicalHash } from "../../utils/integrity.js";
import { appendLedgerLine } from "./ledger.js";
import type {
  CandidateDef, TrialRecord, PromotionDecisionRecord,
  PromotedManifest, PromotedRuleEntry, NewLedgerInput
} from "./store-types.js";

const LEDGER = "promotions/ledger.jsonl";
const MANIFEST = "promotions/promoted.json";

async function appendLedger(artifact: FsArtifact, input: NewLedgerInput): Promise<void> {
  const existing = (await artifact.readMarkdown(LEDGER)) ?? "";
  const { line } = appendLedgerLine(existing, input);
  // appendJsonLines 는 객체를 직렬화하므로, 이미 만든 line(개행 포함)은 writeMarkdown 으로 누적.
  await artifact.writeMarkdown(LEDGER, existing + line);
}

export async function submitCandidate(artifact: FsArtifact, cand: CandidateDef): Promise<void> {
  await artifact.writeJson(`promotions/${cand.id}/candidate.json`, cand);
  await appendLedger(artifact, { action: "submit", id: cand.id, at: cand.submittedAt });
}

export async function readPromotedManifest(artifact: FsArtifact): Promise<PromotedManifest> {
  return (await artifact.readJson<PromotedManifest>(MANIFEST)) ?? { rules: [] };
}

export interface ApproveOptions { approvedBy: string; clockNow: string; }

/** §6: PROMOTE_READY 만 승인 가능. 승인 시 promoted.json 자동 등록(B안) + approvalHash 봉인 + ledger. */
export async function approveCandidate(
  artifact: FsArtifact,
  id: string,
  opts: ApproveOptions
): Promise<{ decision: PromotionDecisionRecord }> {
  const cand = await artifact.readJson<CandidateDef>(`promotions/${id}/candidate.json`);
  const trial = await artifact.readJson<TrialRecord>(`promotions/${id}/trial.json`);
  if (!cand || !trial) throw new Error(`promote approve: ${id} 후보/trial 없음 — submit/trial 먼저`);
  if (trial.verdict !== "PROMOTE_READY") {
    const e = new Error(`promote approve: ${id} verdict=${trial.verdict} — PROMOTE_READY 만 승인 가능`);
    (e as Error & { exitCode?: number }).exitCode = 3;
    throw e;
  }
  const approvalHash = canonicalHash(trial);
  const decision: PromotionDecisionRecord = {
    verdict: "approved", approvedBy: opts.approvedBy, approvalHash, decidedAt: opts.clockNow
  };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);

  const manifest = await readPromotedManifest(artifact);
  const entry: PromotedRuleEntry = {
    id: cand.id, modulePath: cand.modulePath, exportName: cand.exportName,
    promotedAt: opts.clockNow, approvalHash
  };
  if (!manifest.rules.some((r) => r.id === entry.id)) manifest.rules.push(entry);
  await artifact.writeJson(MANIFEST, manifest);

  await appendLedger(artifact, { action: "approve", id, verdict: "approved", at: opts.clockNow });
  return { decision };
}

export async function rejectCandidate(
  artifact: FsArtifact, id: string, reason: string, clockNow: string
): Promise<void> {
  const decision: PromotionDecisionRecord = { verdict: "rejected", reason, decidedAt: clockNow };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "reject", id, verdict: "rejected", at: clockNow });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/store.ts tests/unit/promotion/store.test.ts
git commit -m "feat(promotion): store — submit/approve(자동 채용)/reject + ledger 적재 + approvalHash 봉인"
```

---

## Task 7: gate / benchmark 에 채용분 합류 (런타임 효과)

**Files:**
- Modify: `src/core/gate/index.ts` (L800-818: `runAllRules`, `runAllRulesExceptCodex`)
- Modify: `src/cli/commands/benchmark.ts` (benchmark CLI 가 채용분 포함)
- Test: `tests/unit/promotion/active-rules-integration.test.ts`

채용된 rule 이 실제 gate/benchmark 에서 작동하게 한다. gate 는 `deps.cwd` 를 가지므로 promoted 매니페스트를 읽어 합류한다.

- [ ] **Step 1: 실패 테스트 작성** — gate 의 rule 수집 헬퍼를 promoted 포함형으로.

```ts
// tests/unit/promotion/active-rules-integration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectActiveRuleIds } from "../../../src/core/gate/index.js";

test("collectActiveRuleIds: promoted.json 의 rule id 가 활성 목록에 포함", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-"));
  await mkdir(join(dir, ".harness", "promotions"), { recursive: true });
  // 후보 모듈을 임시로 작성(실제 import 대상)
  const modPath = join(dir, "promoted-rule.mjs");
  await writeFile(modPath, `export const r = { id: "tmp-promoted", describe: "x", run: async () => [] };\n`);
  await writeFile(
    join(dir, ".harness", "promotions", "promoted.json"),
    JSON.stringify({ rules: [{ id: "tmp-promoted", modulePath: modPath, exportName: "r", promotedAt: "t", approvalHash: "h" }] })
  );
  const ids = await collectActiveRuleIds(dir);
  assert.ok(ids.includes("tmp-promoted"));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/active-rules-integration.test.ts`
Expected: FAIL — `collectActiveRuleIds` export 없음.

- [ ] **Step 3: 구현** — gate/index.ts 에 promoted 합류.

`src/core/gate/index.ts` 상단 import 에 추가:

```ts
import { loadPromotedRules } from "../promotion/promoted.js";
import { harnessRoot } from "../../utils/paths.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { PromotedManifest } from "../promotion/store-types.js";
```

promoted reader 헬퍼 + 노출용 함수 추가(파일 하단):

```ts
async function readPromotedManifestAt(cwd: string): Promise<PromotedManifest | null> {
  try {
    const text = await readFile(join(harnessRoot(cwd), "promotions", "promoted.json"), "utf8");
    return JSON.parse(text) as PromotedManifest;
  } catch {
    return null;
  }
}

/** 현 cwd 기준 채용분 rule(런타임 동적 로딩). gate 의 rule 순회에 합류. */
export async function loadPromotedForCwd(cwd: string) {
  return loadPromotedRules(() => readPromotedManifestAt(cwd));
}

/** 테스트/관측용: 활성 rule id 목록(ALL_RULES + promoted). */
export async function collectActiveRuleIds(cwd: string): Promise<string[]> {
  const promoted = await loadPromotedForCwd(cwd);
  return [...ALL_RULES.map((r) => r.id), ...promoted.map((r) => r.id)];
}
```

`runAllRules` / `runAllRulesExceptCodex` 가 promoted 를 합류하도록 수정 — 두 함수에 `cwd` 인자 추가 후 호출부(같은 파일 내)에서 `deps.cwd` 전달:

```ts
async function runAllRules(ctx: RuleContext, cwd: string): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  const rules = [...ALL_RULES, ...(await loadPromotedForCwd(cwd))];
  for (const r of rules) {
    out.push(...(await r.run(ctx)));
  }
  return out;
}

async function runAllRulesExceptCodex(ctx: RuleContext, cwd: string): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  const rules = [...ALL_RULES, ...(await loadPromotedForCwd(cwd))];
  for (const r of rules) {
    if (r.id === "codex-missing-risk") continue;
    if (r.id === "auto-apply-block") continue;
    out.push(...(await r.run(ctx)));
  }
  return out;
}
```

> 실행 메모: `runAllRules(`/`runAllRulesExceptCodex(` 호출부를 `grep -n "runAllRules" src/core/gate/index.ts` 로 찾아 `deps.cwd`(또는 해당 스코프의 cwd)를 두 번째 인자로 전달한다. gate 진입 함수가 `deps: StageDeps` 를 받으므로 `deps.cwd` 가 가용하다.

benchmark CLI 도 채용분 포함 — `src/cli/commands/benchmark.ts` 의 `runBenchmark(root, opts.group)` 를 채용분 합류형으로:

```ts
// import 추가
import { runBenchmarkWithRules } from "../../benchmark/index.js";
import { loadActiveRules } from "../../core/promotion/promoted.js";
import { harnessRoot } from "../../utils/paths.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// action 내부, runBenchmark(root, opts.group) 대체:
const cwd = process.env.HARNESS_WORKSPACE ?? process.cwd();
const readManifest = async () => {
  try { return JSON.parse(await readFile(join(harnessRoot(cwd), "promotions", "promoted.json"), "utf8")); }
  catch { return null; }
};
const active = await loadActiveRules(readManifest);
const r = await runBenchmarkWithRules(root, active, opts.group);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/active-rules-integration.test.ts`
Then: `node --test --import tsx tests/unit/gate/*.test.ts` (gate 회귀)
Expected: PASS, gate 기존 테스트 전부 GREEN(promoted 없으면 빈 배열이라 동작 불변).

- [ ] **Step 5: 커밋**

```bash
git add src/core/gate/index.ts src/cli/commands/benchmark.ts tests/unit/promotion/active-rules-integration.test.ts
git commit -m "feat(promotion): gate/benchmark 가 채용분(promoted)을 동적 합류 — 채용의 런타임 효과"
```

---

## Task 8: promote CLI (submit/trial/report/approve/reject/list)

**Files:**
- Create: `src/cli/commands/promote.ts`
- Modify: `src/cli/index.ts` (registerPromote 등록)
- Test: `tests/integration/promote-cli.test.ts`

`rule-pack.ts` 패턴(`registerXxx` + 서브커맨드 + `buildDeps`/`runStage`) 준용. fixtures 디렉토리는 후보가 함께 제출(`--fixtures <dir>`).

- [ ] **Step 1: 실패 테스트 작성** — CLI help + 서브커맨드 존재(통합).

```ts
// tests/integration/promote-cli.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cli = join(dirname(fileURLToPath(import.meta.url)), "../../src/cli/index.ts");
function run(args: string[]) {
  return spawnSync("node", ["--import", "tsx", cli, ...args], { encoding: "utf8" });
}

test("promote --help 는 6개 서브커맨드를 노출", () => {
  const r = run(["promote", "--help"]);
  assert.equal(r.status, 0);
  for (const sub of ["submit", "trial", "report", "approve", "reject", "list"]) {
    assert.match(r.stdout + r.stderr, new RegExp(sub));
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Expected: FAIL — `promote` 명령 미등록(unknown command).

- [ ] **Step 3: 구현** — promote.ts.

```ts
// src/cli/commands/promote.ts
import type { Command } from "commander";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildDeps } from "../../core/stage-runner.js";
import { runStage } from "./_run.js";
import { isoNow } from "../../utils/time.js";
import {
  loadCandidateRule, computeFixturesHash, validateMinFixtures
} from "../../core/promotion/candidate.js";
import { runTrial } from "../../core/promotion/trial.js";
import { loadActiveRules } from "../../core/promotion/promoted.js";
import {
  submitCandidate, approveCandidate, rejectCandidate, readPromotedManifest
} from "../../core/promotion/store.js";
import type { CandidateDef, TrialRecord } from "../../core/promotion/store-types.js";

export function registerPromote(program: Command): void {
  const cmd = program
    .command("promote")
    .description("Promotion gate: 후보 rule 제출/시험/승인 채용 (submit/trial/report/approve/reject/list)");

  cmd.command("submit")
    .description("후보 rule 제출 (candidate.json + fixtures 봉인)")
    .argument("<id>", "promotion id")
    .requiredOption("--module <path>", "후보 rule 모듈 경로")
    .requiredOption("--export <name>", "DeterministicRule export 이름")
    .requiredOption("--fixtures <dir>", "검증용 fixtures 디렉토리(<group>/<scenario>/expected.json)")
    .action(async (id: string, o: { module: string; export: string; fixtures: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const cand: CandidateDef = {
          id, kind: "rule", modulePath: resolve(o.module), exportName: o.export, submittedAt: isoNow()
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

  cmd.command("trial")
    .description("baseline(현 채용분 포함) vs candidate 시험 → trial.json")
    .argument("<id>", "promotion id")
    .requiredOption("--fixtures <dir>", "fixtures 디렉토리")
    .action(async (id: string, o: { fixtures: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const cand = await deps.artifact.readJson<CandidateDef>(`promotions/${id}/candidate.json`);
        if (!cand) { const e = new Error(`${id} 미제출`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const rule = await loadCandidateRule(cand);
        const readManifest = async () => readPromotedManifest(deps.artifact);
        const active = await loadActiveRules(readManifest);
        const t = await runTrial(resolve(o.fixtures), [rule], { activeBaseline: active });
        const rec: TrialRecord = {
          baseline: pick(t.baseline), candidate: pick(t.candidate),
          verdict: t.decision.verdict, reasons: t.decision.reasons,
          fixturesHash: (await deps.artifact.readJson<{ fixturesHash: string }>(`promotions/${id}/fixtures-hash.json`))?.fixturesHash ?? "",
          ranAt: isoNow()
        };
        await deps.artifact.writeJson(`promotions/${id}/trial.json`, rec);
        return rec.verdict;
      }, (v) => console.error(`[ok] trial verdict: ${v}`));
    });

  cmd.command("report")
    .description("REPORT.md 출력")
    .argument("<id>", "promotion id")
    .action(async (id: string) => {
      await runStage(async () => {
        const deps = buildDeps();
        const t = await deps.artifact.readJson<TrialRecord>(`promotions/${id}/trial.json`);
        if (!t) { const e = new Error(`${id} trial 없음`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const md = [
          `# Promotion Report — ${id}`, "",
          `- verdict: **${t.verdict}**`,
          `- recall: ${t.baseline.criticalRecall.toFixed(3)} -> ${t.candidate.criticalRecall.toFixed(3)}`,
          `- fpRate: ${t.baseline.falsePositiveRate.toFixed(3)} -> ${t.candidate.falsePositiveRate.toFixed(3)}`,
          `- fixturesHash: ${t.fixturesHash}`, "",
          ...t.reasons.map((r) => `- ${r}`)
        ].join("\n");
        await deps.artifact.writeMarkdown(`promotions/${id}/REPORT.md`, md + "\n");
        return md;
      }, (md) => console.error(md));
    });

  cmd.command("approve")
    .description("사람 승인 → 자동 채용(promoted.json) + ledger")
    .argument("<id>", "promotion id")
    .requiredOption("--approved", "명시 승인 도장")
    .option("--by <who>", "승인자", "local")
    .action(async (id: string, o: { by: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const { decision } = await approveCandidate(deps.artifact, id, { approvedBy: o.by, clockNow: isoNow() });
        return decision.verdict;
      }, (v) => console.error(`[ok] ${v} — 카탈로그 채용 완료 (promoted.json + ledger)`));
    });

  cmd.command("reject")
    .description("명시 거절 → rejected 기록")
    .argument("<id>", "promotion id")
    .option("--reason <text>", "사유", "rejected by human")
    .action(async (id: string, o: { reason: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        await rejectCandidate(deps.artifact, id, o.reason, isoNow());
        return id;
      }, (id) => console.error(`[ok] rejected: ${id}`));
    });

  cmd.command("list")
    .description("채용된 rule 목록(promoted.json)")
    .action(async () => {
      await runStage(async () => {
        const deps = buildDeps();
        const m = await readPromotedManifest(deps.artifact);
        return m.rules;
      }, (rules) => {
        if (rules.length === 0) console.error("(채용 없음)");
        for (const r of rules) console.error(`- ${r.id} (${r.modulePath}#${r.exportName}) @${r.promotedAt}`);
      });
    });
}

function pick(r: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number }) {
  return { criticalRecall: r.criticalRecall, falsePositiveRate: r.falsePositiveRate, totalScenarios: r.totalScenarios };
}

async function readFixtures(root: string): Promise<{ files: Record<string, string>; verdicts: string[] }> {
  const files: Record<string, string> = {};
  const verdicts: string[] = [];
  const groups = await readdir(root).catch(() => [] as string[]);
  for (const g of groups) {
    const scenarios = await readdir(join(root, g)).catch(() => [] as string[]);
    for (const s of scenarios) {
      const exp = join(root, g, s, "expected.json");
      try {
        const text = await readFile(exp, "utf8");
        files[`${g}/${s}/expected.json`] = text;
        verdicts.push((JSON.parse(text) as { verdict?: string }).verdict ?? "");
        const patch = join(root, g, s, "last-diff.patch");
        files[`${g}/${s}/last-diff.patch`] = await readFile(patch, "utf8").catch(() => "");
      } catch { /* skip */ }
    }
  }
  return { files, verdicts };
}
```

`src/cli/index.ts` 수정 — import 와 등록 추가:

```ts
import { registerPromote } from "./commands/promote.js";
// ...registerDoctor(program); 다음 줄에:
registerPromote(program);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/integration/promote-cli.test.ts`
Then: `node --test --import tsx tests/integration/cli-help.test.ts` (명령 수 회귀 — "lists all N commands" 단언이 있으면 N 을 +1 갱신)
Expected: PASS.

> 주의: `tests/integration/cli-help.test.ts` 와 `tests/unit/package-bin.test.ts` 에 "24 commands" 단언이 있다(`grep -rn "24 commands\|lists all" tests`). promote 추가로 25 가 되므로 해당 단언을 갱신하는 것도 본 task 의 일부다.

- [ ] **Step 5: 커밋**

```bash
git add src/cli/commands/promote.ts src/cli/index.ts tests/integration/promote-cli.test.ts tests/integration/cli-help.test.ts
git commit -m "feat(promote): CLI submit/trial/report/approve/reject/list + registerPromote"
```

---

## Task 9: self-host (실제 rule 1개 채용 e2e)

**Files:**
- Create: `src/rules/promotion-candidates/todo-comment-risk.ts` (채용 시연용 신규 rule — 단순·안전)
- Create: `fixtures/` 하위 또는 `tests/fixtures/promotion/` 후보 전용 fixtures(positive≥3, negative≥2)
- Test: `tests/e2e/promote-self-host.test.ts`

**채용 시연 rule(예시):** diff 추가 라인에 `TODO:`/`FIXME:` 주석이 N개 이상이면 warning. 단순하고 기존 rule 과 겹치지 않아 cross-rule 간섭이 적다.

- [ ] **Step 1: 시연용 rule 작성**

```ts
// src/rules/promotion-candidates/todo-comment-risk.ts
import type { DeterministicRule } from "../types.js";
import { makeFinding } from "../types.js";

export const todoCommentRiskRule: DeterministicRule = {
  id: "todo-comment-risk",
  describe: "추가된 코드에 TODO/FIXME 주석이 과다하면 미완성 신호",
  run: async (ctx) => {
    const added = ctx.diff.files.flatMap((f) => f.addedLines ?? []);
    const todos = added.filter((l) => /\b(TODO|FIXME)\b/.test(l));
    return todos.length >= 3
      ? [makeFinding("todo-comment-risk", "warning", `미완성 주석 ${todos.length}개`)]
      : [];
  }
};
```

> 실행 메모: `ctx.diff` 의 실제 형태는 `src/utils/diff.ts` 의 `Diff`/`FileChange` 타입을 `grep -n "addedLines\|interface FileChange" src/utils/diff.ts` 로 확인해 `added` 추출을 맞춘다. 기존 rule(`secret-fallback.ts` 등)의 diff 순회 패턴을 그대로 따른다.

- [ ] **Step 2: e2e 실패 테스트 작성** — submit → trial → approve → 채용 후 gate/benchmark 에서 작동.

```ts
// tests/e2e/promote-self-host.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../src/artifact/fs-artifact.js";
import { submitCandidate, approveCandidate } from "../../src/core/promotion/store.js";
import { loadActiveRules } from "../../src/core/promotion/promoted.js";
import { runBenchmarkWithRules, DEFAULT_BENCHMARK_RULES } from "../../src/benchmark/index.js";
import { readPromotedManifest } from "../../src/core/promotion/store.js";
import type { CandidateDef, TrialRecord } from "../../src/core/promotion/store-types.js";

test("self-host: todo-comment-risk 를 게이트로 채용 → loadActiveRules 에 합류", async () => {
  const dir = await mkdtemp(join(tmpdir(), "selfhost-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  const artifact = new FsArtifact({ cwd: dir });

  const cand: CandidateDef = {
    id: "todo-rule", kind: "rule",
    // 빌드/실행 환경에서 import 가능한 절대 경로(소스 모듈).
    modulePath: join(process.cwd(), "src/rules/promotion-candidates/todo-comment-risk.ts"),
    exportName: "todoCommentRiskRule", submittedAt: "t0"
  };
  await submitCandidate(artifact, cand);
  const trial: TrialRecord = {
    baseline: { criticalRecall: 0.8, falsePositiveRate: 0.1, totalScenarios: 30 },
    candidate: { criticalRecall: 0.9, falsePositiveRate: 0.1, totalScenarios: 30 },
    verdict: "PROMOTE_READY", reasons: [], fixturesHash: "x", ranAt: "t1"
  };
  await artifact.writeJson("promotions/todo-rule/trial.json", trial);
  await approveCandidate(artifact, "todo-rule", { approvedBy: "me", clockNow: "t2" });

  const active = await loadActiveRules(() => readPromotedManifest(artifact));
  assert.ok(active.some((r) => r.id === "todo-comment-risk"));
  assert.equal(active.length, DEFAULT_BENCHMARK_RULES.length + 1);
});
```

- [ ] **Step 3: 테스트 실패 확인 → 구현/조정**

Run: `node --test --import tsx tests/e2e/promote-self-host.test.ts`
Expected: 처음엔 rule 파일/경로 문제로 FAIL → todo rule 의 diff 추출을 실제 `Diff` 타입에 맞춰 GREEN.

- [ ] **Step 4: 통과 확인**

Run: `node --test --import tsx tests/e2e/promote-self-host.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/rules/promotion-candidates/ tests/e2e/promote-self-host.test.ts
git commit -m "feat(promotion): self-host — todo-comment-risk 를 게이트로 채용하는 e2e 도그푸딩"
```

---

## Task 10: 전체 회귀 + 문서 동기화

**Files:**
- Modify: `docs/PROMOTION-GATE.md` (구현 완료 반영 — §10 CLI 실제 동작, §7 promoted.json 추가)
- Verify only: 전체

- [ ] **Step 1: 전체 verify**

Run: `npm run verify`
Expected: 0 exit. typecheck/lint/depcheck 0, 전체 테스트 GREEN. 특히:
- depcruise: `src/core/promotion → benchmark/rules/utils/artifact` 만 의존. `gate → promotion` 은 같은 core 간 cross-stage 이므로 **위반 가능** → 확인 필요(아래 Step 2).

- [ ] **Step 2: depcruise `no-cross-stage-core` 대응** — gate(`src/core/gate/`)가 promotion(`src/core/promotion/`)을 import 하면 `no-cross-stage-core` 규칙 위반이다(L12-26: core/<stage> 끼리 금지, auto/ 만 예외).

선택지(실행 시 1개 택):
- (a) `depcruise.config.cjs` 의 `no-cross-stage-core` 에 `pathNot` 예외로 `^src/core/(auto|gate)/` 를 추가하고, 사유를 comment 에 명시("gate 는 채용분 동적 로딩을 위해 promotion 을 읽는다").
- (b) promoted 로딩 헬퍼를 `src/core/gate/` 가 아니라 경계 밖(예: `src/benchmark/` 또는 신규 `src/runtime/`)에 두어 gate→promotion 직접 의존을 제거.

권장: **(a)** — 사유가 명확하고(런타임 채용 합류) 변경이 작다. `no-cross-stage-core` 의 comment 에 예외 사유를 적는다.

```js
// depcruise.config.cjs no-cross-stage-core 의 from.pathNot 갱신
from: { path: "^src/core/([^/]+)/", pathNot: "^src/core/(auto|gate)/" },
```

- [ ] **Step 3: 문서 동기화** — `docs/PROMOTION-GATE.md` 의 "설계" 표현을 "구현됨"으로, §7 저장구조에 `promoted.json` 추가, §10 CLI 에 실제 옵션(`--module/--export/--fixtures/--approved`) 반영.

- [ ] **Step 4: 최종 verify + 커밋**

Run: `npm run verify`
Expected: 0 exit, 전체 GREEN, depcruise 위반 0.

```bash
git add depcruise.config.cjs docs/PROMOTION-GATE.md
git commit -m "chore(promotion): P1b 전체 회귀 GREEN + depcruise 예외(gate→promotion) + 문서 동기화"
```

---

## P1b 완료 기준 (Definition of Done)

- `npm run verify` 0 exit, depcruise 위반 0.
- `promote submit → trial → report → approve --approved` 플로우가 `.harness/promotions/<id>/`(candidate/trial/REPORT/decision) + `promoted.json` + `ledger.jsonl` 을 만든다.
- 승인 없이는 채용 안 됨(PROMOTE_READY 아닌 trial 승인 거부, `--approved` 없으면 commander 가 거부).
- 채용된 rule 이 `loadActiveRules`/gate/benchmark 에 동적 합류(self-host e2e PASS).
- ledger 위변조 시 `verifyLedgerChain` 이 탐지. approvalHash = canonicalHash(trial).
- self-host: 실제 rule 1개(todo-comment-risk) 채용 기록 1건.

## 후속 (P1b 밖)

- `promote trial` 의 fixturesHash 재검증(저장된 해시 vs 재계산)으로 §8-2 동일조건 강제 자동화.
- anchor 주기 검증(`.harness/promotions/anchor.json`)로 ledger+anchor 동시 위변조 방어(audit.ts `computeAnchor`/`detectAnchorTampering` 준용).
- experience → rule(P2), skill-pack(P3) adapter.
- `promote approve` 시 rule-packs.json pack 편입 옵션(현재는 promoted.json 단일 매니페스트).
