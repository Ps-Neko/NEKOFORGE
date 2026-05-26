# Promotion Gate P1a (시험·비교 코어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deterministic rule 후보를 fixture 시험에 태워 "놓침(criticalRecall)↓ AND 헛경보(falsePositiveRate)↑ 없음"일 때만 `PROMOTE_READY` 로 판정하는 승격 게이트의 **코어**(룰셋 주입형 benchmark + 합격 판정 + trial)를 구현한다.

**Architecture:** 기존 `src/benchmark/index.ts` 의 점수 산출은 룰 배열을 모듈 import 로 고정하고 있다. 이를 **룰셋 주입형**으로 연 뒤(회귀 0), `src/core/promotion/` 에 합격 판정(`decide`)과 trial 실행(`trial`)을 둔다. 비교는 전부 deterministic. CLI·저장·ledger·승인 봉인은 후속 계획(P1b)이다.

**Tech Stack:** TypeScript 5.7 (ESM, import 경로에 `.js` 접미사 필수), `node:test` + `tsx`, 순수 함수 위주.

**경로 주의:** 본 계획은 `C:/Users/Mun/NEKOFORGE` 기준. `single-source-engine` 리팩토링으로 코드가 이동하면 `src/` 접두만 조정하면 된다(로직·테스트 불변).

**설계 출처:** `docs/PROMOTION-GATE.md` (§3 P1, §5 합격기준, §14 접점).

---

## File Structure

- **Modify** `src/benchmark/index.ts` — `runScenario` 에 `rules` 파라미터 추가, `runBenchmarkWithRules` 신설, `runBenchmark` 은 `DEFAULT_BENCHMARK_RULES` 로 호출하는 wrapper 로. `DEFAULT_BENCHMARK_RULES` export.
- **Create** `src/core/promotion/types.ts` — `PromoteVerdict`, `PromotionDecision`.
- **Create** `src/core/promotion/decide.ts` — `comparePromotion(baseline, candidate)`.
- **Create** `src/core/promotion/trial.ts` — `runTrial(fixturesRoot, candidateRules, group?)`.
- **Test** `tests/unit/promotion/decide.test.ts`, `tests/unit/promotion/trial.test.ts`, `tests/unit/qf-benchmark-injection.test.ts`.

각 task 는 자체로 `npm test` 를 통과해야 한다.

---

## Task 1: benchmark 룰셋 주입형으로 열기 (회귀 0)

**Files:**
- Modify: `src/benchmark/index.ts`
- Test: `tests/unit/qf-benchmark-injection.test.ts`

- [ ] **Step 1: 회귀 보호 테스트 작성** — 기존 `runBenchmark` 결과가 `runBenchmarkWithRules(root, DEFAULT_BENCHMARK_RULES)` 와 동일함을 보장.

```ts
// tests/unit/qf-benchmark-injection.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  runBenchmark,
  runBenchmarkWithRules,
  DEFAULT_BENCHMARK_RULES
} from "../../src/benchmark/index.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures"
);

test("runBenchmark == runBenchmarkWithRules(DEFAULT_BENCHMARK_RULES) (회귀)", async () => {
  const a = await runBenchmark(fixturesRoot);
  const b = await runBenchmarkWithRules(fixturesRoot, DEFAULT_BENCHMARK_RULES);
  assert.equal(a.totalScenarios, b.totalScenarios);
  assert.equal(a.criticalRecall, b.criticalRecall);
  assert.equal(a.falsePositiveRate, b.falsePositiveRate);
  assert.equal(a.passed, b.passed);
});

test("빈 룰셋이면 critical 미탐 → recall 하락 (주입 동작 증명)", async () => {
  const full = await runBenchmarkWithRules(fixturesRoot, DEFAULT_BENCHMARK_RULES);
  const none = await runBenchmarkWithRules(fixturesRoot, []);
  assert.ok(none.criticalRecall <= full.criticalRecall);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/qf-benchmark-injection.test.ts`
Expected: FAIL — `runBenchmarkWithRules`, `DEFAULT_BENCHMARK_RULES` 가 export 되지 않음.

- [ ] **Step 3: benchmark 리팩토링** — `src/benchmark/index.ts` 에서 ① `DEFAULT_BENCHMARK_RULES` 정의/export, ② `runScenario` 시그니처에 `rules` 추가, ③ `runBenchmarkWithRules` 신설, ④ `runBenchmark` 을 wrapper 로 변경.

```ts
// src/benchmark/index.ts 상단 import 아래에 추가
import type { DeterministicRule } from "../rules/types.js";

export const DEFAULT_BENCHMARK_RULES: readonly DeterministicRule[] = [
  ...ALL_RULES,
  ...ALL_ARCHITECTURE_RULES,
  ...ALL_DESIGN_RULES,
  ...ALL_API_RULES,
  ...ALL_DEPENDENCY_RULES,
  ...ALL_DOCS_RULES,
  ...ALL_RELEASE_EVIDENCE_RULES,
  ...ALL_FRONTEND_RULES
];
```

`runScenario` 의 시그니처와 rule 순회를 교체:

```ts
async function runScenario(
  group: string,
  scenario: string,
  scenarioDir: string,
  rules: readonly DeterministicRule[]
): Promise<BenchmarkScenarioResult | null> {
  // ... diff/expected 로딩 동일 ...
  const findings: RuleFinding[] = [];
  for (const r of rules) {
    findings.push(...(await r.run({ diff, highRiskFlags: {} })));
  }
  // ... 이하 동일 ...
}
```

기존 `runBenchmark` 본문을 `runBenchmarkWithRules` 로 옮기고 `runScenario(..., rules)` 로 호출, `runBenchmark` 은 wrapper 로:

```ts
export async function runBenchmarkWithRules(
  fixturesRoot: string,
  rules: readonly DeterministicRule[],
  filterGroup?: string
): Promise<BenchmarkReport> {
  const results: BenchmarkScenarioResult[] = [];
  let groups: string[];
  try {
    groups = await readdir(fixturesRoot);
  } catch {
    return emptyReport();
  }
  for (const group of groups) {
    if (filterGroup && group !== filterGroup) continue;
    const groupDir = join(fixturesRoot, group);
    try {
      const s = await stat(groupDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    const scenarios = await readdir(groupDir);
    for (const scenario of scenarios) {
      const r = await runScenario(group, scenario, join(groupDir, scenario), rules);
      if (r) results.push(r);
    }
  }
  return summarize(results);
}

export async function runBenchmark(
  fixturesRoot: string,
  filterGroup?: string
): Promise<BenchmarkReport> {
  return runBenchmarkWithRules(fixturesRoot, DEFAULT_BENCHMARK_RULES, filterGroup);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/qf-benchmark-injection.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 전체 회귀 + 커밋**

Run: `npm run verify` (typecheck + lint + depcheck + test). Expected: 0 exit, 기존 `qf-benchmark.test.ts` 포함 전부 PASS.

```bash
git add src/benchmark/index.ts tests/unit/qf-benchmark-injection.test.ts
git commit -m "feat(benchmark): runBenchmarkWithRules — 룰셋 주입형 (promotion gate 토대)"
```

---

## Task 2: PromoteVerdict 타입

**Files:**
- Create: `src/core/promotion/types.ts`

- [ ] **Step 1: 타입 정의** (이 task 는 타입 선언이라 별도 실패 테스트 없이 Task 3 의 테스트가 소비)

```ts
// src/core/promotion/types.ts
/** 승격 판정 결과. decision.schema 의 verdict 어휘를 카탈로그 채용용으로 재사용. */
export type PromoteVerdict =
  | "PROMOTE_READY"
  | "REJECTED"
  | "INSUFFICIENT_EVIDENCE"
  | "NEEDS_HUMAN_REVIEW";

export interface PromotionDecision {
  verdict: PromoteVerdict;
  reasons: string[];
}
```

- [ ] **Step 2: 타입 체크 + 커밋**

Run: `npm run typecheck`
Expected: 0 exit.

```bash
git add src/core/promotion/types.ts
git commit -m "feat(promotion): PromoteVerdict / PromotionDecision 타입"
```

---

## Task 3: comparePromotion (엄격 합격 판정)

**Files:**
- Create: `src/core/promotion/decide.ts`
- Test: `tests/unit/promotion/decide.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — PROMOTION-GATE.md §5 의 엄격 기준 경계 전수.

```ts
// tests/unit/promotion/decide.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePromotion } from "../../../src/core/promotion/decide.js";
import type { BenchmarkReport } from "../../../src/benchmark/index.js";

function rep(recall: number, fp: number): BenchmarkReport {
  return {
    totalScenarios: 0, passed: 0, failed: 0, byGroup: {},
    criticalRecall: recall, falsePositiveRate: fp, results: []
  };
}

test("recall↑ + fp 동일 → PROMOTE_READY", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.9, 0.1)).verdict, "PROMOTE_READY");
});
test("recall 동일 + fp↓ → PROMOTE_READY", () => {
  assert.equal(comparePromotion(rep(0.8, 0.2), rep(0.8, 0.1)).verdict, "PROMOTE_READY");
});
test("fp 악화 → REJECTED", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.9, 0.2)).verdict, "REJECTED");
});
test("recall 하락 → REJECTED", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.7, 0.05)).verdict, "REJECTED");
});
test("완전 동률 → NEEDS_HUMAN_REVIEW (개선 없음)", () => {
  assert.equal(comparePromotion(rep(0.8, 0.1), rep(0.8, 0.1)).verdict, "NEEDS_HUMAN_REVIEW");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/decide.test.ts`
Expected: FAIL — `decide.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/decide.ts
import type { BenchmarkReport } from "../../benchmark/index.js";
import type { PromotionDecision } from "./types.js";

/**
 * 엄격 합격 판정 (PROMOTION-GATE.md §5).
 *   recall(after) ≥ recall(before) AND fpRate(after) ≤ fpRate(before)
 *   AND 최소 하나는 strict 개선 → PROMOTE_READY
 *   동률 → NEEDS_HUMAN_REVIEW, 악화 → REJECTED
 * 전체 룰셋 점수 기준(cross-rule interference 반영).
 */
export function comparePromotion(
  baseline: BenchmarkReport,
  candidate: BenchmarkReport
): PromotionDecision {
  const reasons = [
    `recall ${baseline.criticalRecall.toFixed(3)} -> ${candidate.criticalRecall.toFixed(3)}`,
    `fpRate ${baseline.falsePositiveRate.toFixed(3)} -> ${candidate.falsePositiveRate.toFixed(3)}`
  ];
  const recallOk = candidate.criticalRecall >= baseline.criticalRecall;
  const fpOk = candidate.falsePositiveRate <= baseline.falsePositiveRate;
  if (!recallOk || !fpOk) {
    return { verdict: "REJECTED", reasons: [...reasons, "지표 악화 — 둘 다 개선 조건 위반"] };
  }
  const recallStrict = candidate.criticalRecall > baseline.criticalRecall;
  const fpStrict = candidate.falsePositiveRate < baseline.falsePositiveRate;
  if (recallStrict || fpStrict) {
    return { verdict: "PROMOTE_READY", reasons };
  }
  return { verdict: "NEEDS_HUMAN_REVIEW", reasons: [...reasons, "개선 없음(동률) — 사람 판단 필요"] };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/decide.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/core/promotion/decide.ts tests/unit/promotion/decide.test.ts
git commit -m "feat(promotion): comparePromotion — 엄격 합격 판정 (놓침↓ AND 헛경보 안 늘)"
```

---

## Task 4: runTrial (baseline vs candidate 시험)

**Files:**
- Create: `src/core/promotion/trial.ts`
- Test: `tests/unit/promotion/trial.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — 후보 rule 이 없으면(빈 배열) baseline==candidate → NEEDS_HUMAN_REVIEW. 가짜 "헛경보 rule"(모든 PASS fixture 에 high 발화)을 후보로 넣으면 fp 악화 → REJECTED.

```ts
// tests/unit/promotion/trial.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runTrial } from "../../../src/core/promotion/trial.js";
import type { DeterministicRule } from "../../../src/rules/types.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

// 모든 변경에 high finding 을 뱉는 "헛경보 유발" 후보 rule.
const noisyRule: DeterministicRule = {
  id: "noisy-test-rule",
  describe: "test-only: always fires high",
  run: async () => [{ ruleId: "noisy-test-rule", severity: "high", message: "noise" }]
};

test("후보 없음(빈 배열) → 동률 → NEEDS_HUMAN_REVIEW", async () => {
  const t = await runTrial(fixturesRoot, []);
  assert.equal(t.decision.verdict, "NEEDS_HUMAN_REVIEW");
});

test("헛경보 유발 후보 → fp 악화 → REJECTED", async () => {
  const t = await runTrial(fixturesRoot, [noisyRule]);
  assert.equal(t.decision.verdict, "REJECTED");
  assert.ok(t.candidate.falsePositiveRate >= t.baseline.falsePositiveRate);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/promotion/trial.test.ts`
Expected: FAIL — `trial.js` 없음.

- [ ] **Step 3: 구현**

```ts
// src/core/promotion/trial.ts
import {
  runBenchmarkWithRules,
  DEFAULT_BENCHMARK_RULES,
  type BenchmarkReport
} from "../../benchmark/index.js";
import type { DeterministicRule } from "../../rules/types.js";
import { comparePromotion } from "./decide.js";
import type { PromotionDecision } from "./types.js";

export interface TrialResult {
  baseline: BenchmarkReport;
  candidate: BenchmarkReport;
  decision: PromotionDecision;
}

/**
 * 동일 fixture 로 baseline(현 카탈로그) vs candidate(현 + 후보 rule) 두 번 시험 후 비교.
 * candidate rule 은 호출자가 구성(P1b 에서 파일 로딩/해시 봉인 추가).
 */
export async function runTrial(
  fixturesRoot: string,
  candidateRules: readonly DeterministicRule[],
  filterGroup?: string
): Promise<TrialResult> {
  const baseline = await runBenchmarkWithRules(
    fixturesRoot,
    DEFAULT_BENCHMARK_RULES,
    filterGroup
  );
  const candidate = await runBenchmarkWithRules(
    fixturesRoot,
    [...DEFAULT_BENCHMARK_RULES, ...candidateRules],
    filterGroup
  );
  return { baseline, candidate, decision: comparePromotion(baseline, candidate) };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/promotion/trial.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 전체 회귀 + 커밋**

Run: `npm run verify`
Expected: 0 exit, 전체 PASS, depcruise 위반 0 (promotion 모듈이 benchmark/rules 만 의존).

```bash
git add src/core/promotion/trial.ts tests/unit/promotion/trial.test.ts
git commit -m "feat(promotion): runTrial — baseline vs candidate 시험 + 판정 (P1a 코어 완료)"
```

---

## P1a 완료 기준 (Definition of Done)

- `npm run verify` 0 exit.
- `runBenchmark` 결과 회귀 없음(Task 1 회귀 테스트 PASS).
- 빈 후보 → NEEDS_HUMAN_REVIEW, 헛경보 후보 → REJECTED 가 통합 테스트로 증명.
- promotion 모듈이 deterministic(LLM 호출 0). depcruise 위반 0.

## 후속 (P1b — 본 계획 밖)

- `src/core/promotion/candidate.ts` — 후보 파일/fixture 로딩 + `canonicalHash` 봉인 + 최소 fixture(positive≥3, negative≥2) 검증.
- `src/core/promotion/store.ts` — `.harness/promotions/` 저장 + `ledger.jsonl` append-only + `approvalHash`.
- `src/cli/commands/promote.ts` — `submit/trial/report/approve/reject/list` + `registerPromote(program)` 등록.
- self-host: 실제 신규 rule 1개를 본 게이트로 채용.
