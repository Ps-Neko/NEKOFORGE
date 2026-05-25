# Auto-Factory Walking Skeleton 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `harness auto "<goal>"` 한 줄로 14단계를 자동 진행 — AI(claude)가 코드를 짜고, Codex가 독립 검수하고, deterministic gate가 판정한 뒤 Human Gate에서 정지(자동 apply 없음).

**Architecture:** 기존 `self-host` 명령(`src/cli/commands/self-host.ts`)이 이미 14단계를 tmpdir에서 순서대로 구동하고 gate에서 멈춘다. `auto`는 그 구조를 재사용하되 세 곳만 바꾼다 — ①work: 기존 diff 캡처 → claude 어댑터가 코드 생성 후 diff 캡처, ②review: 빈 어댑터 → codex 독립 검수, ③비용 가드 추가. 어댑터·diff 캡처는 주입 가능(테스트는 fake, 실사용은 claude/codex + git).

**Tech Stack:** TypeScript 5.7, Node 20+ ESM, `node:test` + `tsx`(테스트), commander(CLI), `spawnSync`(어댑터). 기존 패턴: `src/integrations/codex/real.ts`(주입형 spawn), `src/core/stage-runner.ts`(`buildDeps`).

**스펙:** `docs/AUTO-FACTORY-SPEC.md`. **브랜치:** `feat/auto-factory-skeleton` (moat 포트 베이스 위).

---

## File Structure

| 액션 | 파일 | 책임 |
|---|---|---|
| Create | `src/core/auto/cost-guard.ts` | 비용 누적·상한 초과 시 호출 전 차단(`CostExceededError`). |
| Create | `src/workers/adapters/claude.ts` | 실제 Claude `WorkerAdapter` — `claude` CLI spawn(주입형). |
| Modify | `src/workers/adapter.ts` | `resolveWorkerAdapter`에 claude 등록. |
| Modify | `src/workers/dispatch.ts` | `renderPrompt`에 SPEC/PLAN/task 맥락 주입(AC2b). |
| Create | `src/core/auto/index.ts` | `runAuto` 오케스트레이터 — self-host 모델, work=AI생성·review=codex·cost-guard·gate 정지. |
| Create | `src/cli/commands/auto.ts` | `harness auto` 명령 배선. |
| Modify | `src/cli/index.ts` | `registerAuto(program)` 등록. |
| Test | `tests/unit/auto/cost-guard.test.ts`, `tests/unit/workers/claude-adapter.test.ts`, `tests/unit/workers/dispatch-context.test.ts`, `tests/unit/auto/orchestrator.test.ts`, `tests/e2e/auto-skeleton.test.ts` | 각 단위 + e2e. |

전제: 어댑터/캡처는 `runAuto`에 주입한다 → 라이브 LLM 없이 결정적 테스트. 실제 claude/codex는 수동 smoke(Task 7)로만.

---

## Task 1: Cost Guard

**Files:**
- Create: `src/core/auto/cost-guard.ts`
- Test: `tests/unit/auto/cost-guard.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/auto/cost-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCostGuard, CostExceededError } from "../../../src/core/auto/cost-guard.js";

test("cost-guard: 예산 내 호출은 통과하고 누적된다", () => {
  const g = createCostGuard(1.0);
  g.assertCanSpend(0.4);
  g.record(0.4);
  g.assertCanSpend(0.5);
  g.record(0.5);
  assert.equal(g.spent(), 0.9);
});

test("cost-guard: 예산 초과 예상이면 호출 전 throw (exitCode 5)", () => {
  const g = createCostGuard(0.5);
  g.record(0.4);
  assert.throws(() => g.assertCanSpend(0.2), (e: unknown) => {
    assert.ok(e instanceof CostExceededError);
    assert.equal((e as CostExceededError).exitCode, 5);
    assert.match((e as Error).message, /0\.5/);
    return true;
  });
});

test("cost-guard: maxUsd=0 이면 첫 호출 전 즉시 차단", () => {
  const g = createCostGuard(0);
  assert.throws(() => g.assertCanSpend(0.01), CostExceededError);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/auto/cost-guard.test.ts`
Expected: FAIL — `Cannot find module '.../cost-guard.js'`

- [ ] **Step 3: 최소 구현**

```typescript
// src/core/auto/cost-guard.ts
/**
 * auto 비용 가드 — AI 호출 누적이 maxUsd 를 넘길 것 같으면 호출 *전*에 차단.
 * WF-3 §5(LLM spawn 비용 가드). 추정은 보수적(상한)으로.
 */
export class CostExceededError extends Error {
  readonly exitCode = 5;
  constructor(message: string) {
    super(message);
    this.name = "CostExceededError";
  }
}

export interface CostGuard {
  /** estUsd 를 더하면 maxUsd 초과인지 검사. 초과면 throw. */
  assertCanSpend(estUsd: number): void;
  /** 실제 지출 누적. */
  record(actualUsd: number): void;
  /** 현재까지 누적 지출. */
  spent(): number;
}

export function createCostGuard(maxUsd: number): CostGuard {
  let total = 0;
  return {
    assertCanSpend(estUsd: number): void {
      if (total + estUsd > maxUsd) {
        throw new CostExceededError(
          `예상 비용 $${(total + estUsd).toFixed(2)} 가 상한 $${maxUsd.toFixed(2)} 초과 (현재 지출 $${total.toFixed(2)}). 호출 중단.`
        );
      }
    },
    record(actualUsd: number): void {
      total += actualUsd;
    },
    spent(): number {
      return total;
    }
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/auto/cost-guard.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/core/auto/cost-guard.ts tests/unit/auto/cost-guard.test.ts
git commit -m "feat(auto): cost-guard — AI 호출 비용 상한 사전 차단"
```

---

## Task 2: Claude Worker Adapter

**Files:**
- Create: `src/workers/adapters/claude.ts`
- Modify: `src/workers/adapter.ts` (resolveWorkerAdapter 등록)
- Test: `tests/unit/workers/claude-adapter.test.ts`

`src/integrations/codex/real.ts`의 주입형 spawn 패턴을 그대로 따른다(`SpawnLike`, `available()`는 `--version` probe). `WorkerAdapter` 인터페이스는 `src/workers/adapter.ts:29` 참조(`id`, `available()`, `dispatch(input): Promise<WorkerAdapterResult>`).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/workers/claude-adapter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeWorkerAdapter } from "../../../src/workers/adapters/claude.js";
import type { SpawnLike } from "../../../src/workers/adapters/claude.js";

const okSpawn: SpawnLike = (_cmd, args) => {
  if (args.includes("--version")) return { status: 0, stdout: "claude 2.1.150", stderr: "" };
  return { status: 0, stdout: "구현 완료: src/foo.ts 에 함수 추가", stderr: "" };
};

test("claude adapter: available() 는 --version probe 성공 시 true", async () => {
  const a = createClaudeWorkerAdapter({ spawn: okSpawn });
  assert.equal(await a.available(), true);
});

test("claude adapter: dispatch 는 prompt 를 stdin 으로 넘기고 completed 반환", async () => {
  let sentInput = "";
  const spy: SpawnLike = (_cmd, _args, opts) => {
    sentInput = opts?.input ?? "";
    return { status: 0, stdout: "done", stderr: "" };
  };
  const a = createClaudeWorkerAdapter({ spawn: spy });
  const r = await a.dispatch({ role: "implementation-worker", prompt: "PROMPT-XYZ", taskId: "TASK-001" });
  assert.equal(r.status, "completed");
  assert.match(sentInput, /PROMPT-XYZ/);
});

test("claude adapter: non-zero exit 이면 failed", async () => {
  const badSpawn: SpawnLike = () => ({ status: 1, stdout: "", stderr: "boom" });
  const a = createClaudeWorkerAdapter({ spawn: badSpawn });
  const r = await a.dispatch({ role: "implementation-worker", prompt: "x", taskId: "T" });
  assert.equal(r.status, "failed");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/workers/claude-adapter.test.ts`
Expected: FAIL — module 없음

- [ ] **Step 3: 최소 구현**

```typescript
// src/workers/adapters/claude.ts
/**
 * Claude CLI 워커 어댑터 (WF-3). `claude` 실행파일에 work 프롬프트를 stdin 으로
 * 넘겨 코드를 생성/편집하게 한다. spawn 은 주입 가능(테스트는 fake).
 * codex/real.ts 와 동일한 주입형 패턴.
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type { WorkerAdapter, WorkerAdapterInput, WorkerAdapterResult } from "../adapter.js";

export interface SpawnResult { status: number | null; stdout: string; stderr: string; }
export interface SpawnOptions { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; }
export type SpawnLike = (command: string, args: readonly string[], options?: SpawnOptions) => SpawnResult;

export interface ClaudeAdapterOptions {
  command?: string;
  args?: readonly string[];
  spawn?: SpawnLike;
  timeoutMs?: number;
  /** 1회 호출 비용 추정(USD). cost-guard 용. 기본 보수값. */
  estimateCostUsd?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function defaultSpawn(command: string, args: readonly string[], options: SpawnOptions = {}): SpawnResult {
  const r = nodeSpawnSync(command, [...args], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.env ? { env: options.env } : {})
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function createClaudeWorkerAdapter(opts: ClaudeAdapterOptions = {}): WorkerAdapter & { estimateCostUsd: number } {
  const command = opts.command ?? "claude";
  const args = opts.args ?? ["-p"]; // print 모드: stdin 프롬프트 → 작업 수행
  const spawn = opts.spawn ?? defaultSpawn;
  return {
    id: "claude",
    estimateCostUsd: opts.estimateCostUsd ?? 0.5,
    async available(): Promise<boolean> {
      try {
        return spawn(command, ["--version"]).status === 0;
      } catch {
        return false;
      }
    },
    async dispatch(input: WorkerAdapterInput): Promise<WorkerAdapterResult> {
      const r = spawn(command, args, { input: input.prompt, timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
      if (r.status !== 0) {
        return {
          status: "failed",
          resultMd: `# ${input.role} — claude 어댑터 실패\n\nexit=${r.status}\n${(r.stderr || r.stdout).slice(0, 500)}`,
          ...(r.status !== null ? { exitCode: r.status } : {}),
          notes: "claude non-zero exit"
        };
      }
      return {
        status: "completed",
        resultMd: `# ${input.role} — claude 결과\n\n${r.stdout.slice(0, 4000)}`,
        notes: "claude completed"
      };
    }
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/workers/claude-adapter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: resolveWorkerAdapter 에 등록**

`src/workers/adapter.ts`의 `resolveWorkerAdapter` 수정 — 기존(`shell`/`shell-stub`만 반환) 아래에 추가:

```typescript
// src/workers/adapter.ts — import 추가
import { createClaudeWorkerAdapter } from "./adapters/claude.js";

// resolveWorkerAdapter 내부, shell 분기 다음에:
  if (id === "claude") {
    return createClaudeWorkerAdapter();
  }
```

- [ ] **Step 6: 커밋**

```bash
git add src/workers/adapters/claude.ts src/workers/adapter.ts tests/unit/workers/claude-adapter.test.ts
git commit -m "feat(workers): 실제 Claude 워커 어댑터 + resolveWorkerAdapter 등록"
```

---

## Task 3: 프롬프트 맥락 주입 (AC2b)

**Files:**
- Modify: `src/workers/dispatch.ts` (`renderPrompt` + `runDispatch`/`runDispatchAll` 가 deps 로 SPEC/PLAN 읽어 전달)
- Test: `tests/unit/workers/dispatch-context.test.ts`

현재 `renderPrompt(taskId, role, workers)`는 역할 템플릿만 쓴다(`src/workers/dispatch.ts:140`). SPEC.md/PLAN.md 본문을 프롬프트에 끼운다.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/workers/dispatch-context.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPrompt } from "../../../src/workers/dispatch.js";

test("renderPrompt: SPEC/PLAN 맥락이 프롬프트 본문에 주입된다", () => {
  const workers = { profile: "standard", workers: [{ id: "impl-1", role: "implementation-worker" }] } as never;
  const body = renderPrompt("TASK-001", "implementation-worker", workers, {
    spec: "## 목표\n로그인 잠금 기능",
    plan: "- TASK-001: lockout 구현"
  });
  assert.match(body, /로그인 잠금 기능/);
  assert.match(body, /lockout 구현/);
});

test("renderPrompt: context 없으면 기존처럼 템플릿만 (하위호환)", () => {
  const workers = { profile: "standard", workers: [{ id: "impl-1", role: "implementation-worker" }] } as never;
  const body = renderPrompt("TASK-001", "implementation-worker", workers);
  assert.match(body, /최소 동작|minimal viable|구현안/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/workers/dispatch-context.test.ts`
Expected: FAIL — `renderPrompt` 인자 4개 미지원 / context 섹션 없음

- [ ] **Step 3: 최소 구현**

`renderPrompt` 시그니처에 optional 4번째 인자 추가, `## 작업 맥락` 섹션 삽입. 기존 `src/workers/dispatch.ts:140-196` 의 `renderPrompt` 를 아래로 교체(임무 섹션 위에 맥락 주입):

```typescript
export interface PromptContext { spec?: string; plan?: string; }

function renderPrompt(
  taskId: string,
  role: WorkerRole,
  workers: WorkersJson,
  context: PromptContext = {}
): string {
  const profile = workers.profile;
  const contextBlock = (context.spec || context.plan)
    ? [
        `## 작업 맥락 (SPEC/PLAN 발췌)`,
        "",
        context.spec ? `### SPEC\n${context.spec.slice(0, 3000)}` : "",
        context.plan ? `### PLAN\n${context.plan.slice(0, 2000)}` : "",
        ""
      ].filter(Boolean).join("\n")
    : "";
  return [
    `# Worker Prompt — ${role}`,
    "",
    `- task: ${taskId}`,
    `- profile: ${profile}`,
    `- role: ${role}`,
    `- forbidden actions: no-commit, no-push, no-deploy, no-apply, no-decision-write`,
    "",
    contextBlock,
    `## 임무`,
    "",
    ROLE_PROMPT[role],
    "",
    `## 결과 위치`,
    "",
    `\`.harness/worker-runs/${taskId}/${role}.result.md\` (markdown 본문)`,
    `\`.harness/worker-runs/${taskId}/${role}.result.json\` (구조화 finding)`,
    "",
    `## 절대 하지 않을 것`,
    "",
    `- decision.json 직접 작성/수정`,
    `- audit.jsonl 직접 수정`,
    `- commit/push/deploy/apply 실행`,
    `- quality-contract.json 의 qualityBars 약화`,
    `- 다른 worker 의 result 덮어쓰기`,
    ""
  ].join("\n");
}
```

그리고 `renderPrompt` 를 `export` 로 바꾼다(테스트가 import). `runDispatch`/`runDispatchAll` 는 호출 전 `deps.artifact.readMarkdown("SPEC.md")` / `readMarkdown("PLAN.md")` 를 읽어 `{ spec, plan }` 으로 전달(없으면 undefined → 하위호환).

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/workers/dispatch-context.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 회귀 확인 + 커밋**

```bash
node --test --import tsx tests/unit/**/*.test.ts
git add src/workers/dispatch.ts tests/unit/workers/dispatch-context.test.ts
git commit -m "feat(workers): dispatch 프롬프트에 SPEC/PLAN 맥락 주입 (AC2b)"
```

---

## Task 4: Auto 오케스트레이터

**Files:**
- Create: `src/core/auto/index.ts`
- Test: `tests/unit/auto/orchestrator.test.ts`

`src/cli/commands/self-host.ts:118-203` 의 단계 구동을 모델로 한다. 동일 import 사용(`runInit, runIntake, runClarify, runContext, runSpec, runPlan, runDesign, runPolicy, runTeam, runQualityContract, runWorkersInit, ensureRulePacks, ensureSkillPacks, runReview, runGate`). **차이 3개**: ①work = `workerAdapter.dispatch(prompt)` 후 `captureDiff()` 로 diff 확보, ②`runReview({ adapters: [reviewAdapter] })`(codex), ③각 AI 호출 전 `costGuard.assertCanSpend`. **gate 후 apply 호출 안 함**(self-host 와 동일하게 정지).

주입 인터페이스(테스트 결정성):

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/auto/orchestrator.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAuto } from "../../../src/core/auto/index.js";

function fakeWorkerAdapter(diff: string) {
  return {
    id: "fake", estimateCostUsd: 0.1,
    async available() { return true; },
    async dispatch() { return { status: "completed" as const, resultMd: "fake impl" }; },
    // 오케스트레이터가 dispatch 후 captureDiff() 로 diff 확보 → 여기선 주입으로 대체
  };
}
const fakeReviewAdapter = {
  id: "fake-codex",
  async available() { return true; },
  async run() { return { adapterId: "fake-codex", status: "passed" as const, findings: [] }; }
};

test("runAuto: 끝까지 진행해 verdict 를 내고 apply 는 절대 호출 안 함", async () => {
  let applyCalled = false;
  const r = await runAuto({
    goal: "테스트 목표", taskId: "TASK-001", maxCostUsd: 5,
    workerAdapter: fakeWorkerAdapter(""),
    reviewAdapter: fakeReviewAdapter,
    captureDiff: () => "diff --git a/src/x.ts b/src/x.ts\n+const x = 1;",
    onApply: () => { applyCalled = true; }   // 존재해도 호출되면 안 됨
  });
  assert.ok(["PASS", "PASS_WITH_WARNINGS", "NEEDS_HUMAN_REVIEW", "BLOCK", "INSUFFICIENT_EVIDENCE"].includes(r.verdict));
  assert.equal(r.applied, false);
  assert.equal(applyCalled, false);
});

test("runAuto: --max-cost 0 이면 AI 호출 전 CostExceededError", async () => {
  await assert.rejects(
    () => runAuto({
      goal: "x", taskId: "TASK-001", maxCostUsd: 0,
      workerAdapter: fakeWorkerAdapter(""), reviewAdapter: fakeReviewAdapter,
      captureDiff: () => ""
    }),
    /상한|CostExceeded/
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test --import tsx tests/unit/auto/orchestrator.test.ts`
Expected: FAIL — module 없음

- [ ] **Step 3: 구현** (self-host 의 단계 구동 복제 + 3개 차이)

```typescript
// src/core/auto/index.ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../stage-runner.js";
import { runInit } from "../init.js";
import { runIntake } from "../intake/index.js";
import { runClarify } from "../clarify/index.js";
import { runContext } from "../context/index.js";
import { runSpec } from "../spec/index.js";
import { runPlan } from "../plan/index.js";
import { runDesign } from "../harness-design/index.js";
import { runPolicy } from "../quality-policy/index.js";
import { runTeam } from "../team/index.js";
import { runQualityContract } from "../quality-contract/index.js";
import { runReview } from "../review/index.js";
import { runGate } from "../gate/index.js";
import { runWorkersInit } from "../../workers/index.js";
import { ensureRulePacks } from "../../rule-packs/index.js";
import { ensureSkillPacks } from "../../skill-packs/index.js";
import { renderPrompt } from "../../workers/dispatch.js";
import { readGitDiff, diffHash } from "../../utils/git.js";
import { isoNow, systemClock } from "../../utils/time.js";
import { createCostGuard } from "./cost-guard.js";
import type { WorkerAdapter } from "../../workers/adapter.js";
import type { ReviewAdapter } from "../../integrations/review-adapter.js";
import type { Verdict } from "../gate/verdict.js";

const DEFAULT_SPEC = { /* self-host.ts:46 의 DEFAULT_SPEC 와 동일 객체 복사 */ } as Record<string, string>;
const DEFAULT_CONTRACT = { /* self-host.ts:56 의 DEFAULT_CONTRACT 복사 */ } as Record<string, string>;

export interface AutoInput {
  goal: string;
  taskId?: string;
  maxCostUsd: number;
  workerAdapter: WorkerAdapter & { estimateCostUsd?: number };
  reviewAdapter: ReviewAdapter;
  /** work 후 diff 캡처. 실사용 = () => readGitDiff(cwd) ?? "". 테스트 = fake. */
  captureDiff: () => string;
  /** 존재 시에도 절대 호출 안 함(테스트 가드). */
  onApply?: () => void;
}

export interface AutoResult {
  verdict: Verdict;
  triggeredRules: string[];
  reportPath: string;
  workspace: string;
  applied: false;
  spentUsd: number;
}

export async function runAuto(input: AutoInput): Promise<AutoResult> {
  const taskId = input.taskId ?? "TASK-001";
  const guard = createCostGuard(input.maxCostUsd);
  const ws = await mkdtemp(join(tmpdir(), "nekoforge-auto-"));
  await runInit({ cwd: ws });
  const deps = buildDeps(ws);

  // 구조 단계 (self-host 와 동일, 기본값)
  await runIntake({ goal: input.goal }, deps);
  await runClarify(deps);
  await runContext(deps);
  const specAnswers = join(ws, "spec-answers.json");
  await writeFile(specAnswers, JSON.stringify(DEFAULT_SPEC), "utf8");
  await runSpec({ answersFile: specAnswers }, deps);
  await runPlan({}, deps);
  await runDesign({ pattern: "Pipeline" }, deps);
  await runPolicy({}, deps);
  await runTeam(deps);
  const contractAnswers = join(ws, "contract-answers.json");
  await writeFile(contractAnswers, JSON.stringify(DEFAULT_CONTRACT), "utf8");
  await runQualityContract({ taskId, template: "custom", answersFile: contractAnswers }, deps);
  await runWorkersInit({ profile: "standard", force: true }, deps);
  await ensureRulePacks(deps);
  await ensureSkillPacks(deps);

  // ① work — AI 가 코드 생성 (cost-guard 로 사전 차단)
  const spec = (await deps.artifact.readMarkdown("SPEC.md")) ?? undefined;
  const plan = (await deps.artifact.readMarkdown("PLAN.md")) ?? undefined;
  const workers = { profile: "standard", workers: [{ id: "impl-1", role: "implementation-worker" }] } as never;
  const prompt = renderPrompt(taskId, "implementation-worker", workers, { spec, plan });
  guard.assertCanSpend(input.workerAdapter.estimateCostUsd ?? 0.5);
  const work = await input.workerAdapter.dispatch({ role: "implementation-worker", prompt, taskId });
  guard.record(input.workerAdapter.estimateCostUsd ?? 0.5);
  if (work.status === "failed") {
    const e = new Error(`work 단계 실패: ${work.notes ?? "adapter failed"}`) as Error & { exitCode?: number };
    e.exitCode = 6;
    throw e;
  }
  const diff = input.captureDiff();
  await deps.artifact.writeMarkdown("last-diff.patch", diff);
  await deps.artifact.writeMarkdown(`pending/${taskId}.patch`, diff);
  await deps.artifact.writeMarkdown(
    "worklog.md",
    `## ${taskId} — ${isoNow(systemClock)}\n- diff hash: ${diffHash(diff)}\n- via: auto (claude work)\n\n`
  );

  // ② review — codex 독립 검수
  guard.assertCanSpend(0.2);
  await runReview({ adapters: [input.reviewAdapter] }, deps);
  guard.record(0.2);

  // ③ gate — verdict. 그리고 정지 (apply 호출 안 함).
  const r = await runGate({ taskId }, deps);
  return {
    verdict: r.verdict,
    triggeredRules: r.triggeredRules,
    reportPath: r.reportPath,
    workspace: ws,
    applied: false,
    spentUsd: guard.spent()
  };
}
```

> 주: `DEFAULT_SPEC`/`DEFAULT_CONTRACT` 는 `self-host.ts:46,56` 의 객체를 복사한다. 중복이 싫으면 후속에서 `core/auto/defaults.ts` 로 공통 추출(YAGNI — 지금은 복사).

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test --import tsx tests/unit/auto/orchestrator.test.ts`
Expected: PASS (2 tests). 만약 `runReview` 가 빈 어댑터를 기대하거나 시그니처가 다르면 `self-host.ts:185` 호출 형태로 맞춘다.

- [ ] **Step 5: 커밋**

```bash
git add src/core/auto/index.ts tests/unit/auto/orchestrator.test.ts
git commit -m "feat(auto): runAuto 오케스트레이터 — work(AI)+codex review+gate 정지, cost-guard"
```

---

## Task 5: `harness auto` CLI 명령

**Files:**
- Create: `src/cli/commands/auto.ts`
- Modify: `src/cli/index.ts` (`registerAuto(program)`)
- Test: (Task 6 e2e 가 커버)

`src/cli/commands/self-host.ts:101` 의 `registerSelfHost` + `src/cli/commands/gate.ts` 의 옵션 패턴을 따른다. 실사용 어댑터: worker=`createClaudeWorkerAdapter()`, review=`createCodexRealAdapter()`(`--adapter` 로 선택), captureDiff=`() => readGitDiff(process.cwd()) ?? ""`.

- [ ] **Step 1: 구현**

```typescript
// src/cli/commands/auto.ts
import type { Command } from "commander";
import { runAuto } from "../../core/auto/index.js";
import { createClaudeWorkerAdapter } from "../../workers/adapters/claude.js";
import { createCodexRealAdapter } from "../../integrations/codex/real.js";
import { createCodexStubAdapter } from "../../integrations/codex/stub.js";
import { readGitDiff } from "../../utils/git.js";
import { gateStrictExitCode } from "../../core/gate/verdict.js";

interface AutoOpts { task?: string; adapter?: string; maxCost?: string; strict?: boolean; }

export function registerAuto(program: Command): void {
  program
    .command("auto <goal>")
    .description("14단계를 자동 진행하고 Human Gate 에서 정지 (AI 코드생성 + Codex 독립검수). 자동 apply 없음.")
    .option("--task <id>", "task id", "TASK-001")
    .option("--adapter <id>", "review adapter (codex | codex-stub)", "codex")
    .option("--max-cost <usd>", "AI 호출 비용 상한(USD)", "5")
    .option("--strict", "verdict 가 clean PASS 아니면 non-zero exit")
    .action(async (goal: string, opts: AutoOpts) => {
      const reviewAdapter = opts.adapter === "codex-stub"
        ? createCodexStubAdapter({ enabled: true })
        : createCodexRealAdapter();
      try {
        const r = await runAuto({
          goal,
          taskId: opts.task ?? "TASK-001",
          maxCostUsd: Number(opts.maxCost ?? "5"),
          workerAdapter: createClaudeWorkerAdapter(),
          reviewAdapter,
          captureDiff: () => readGitDiff(process.cwd()) ?? ""
        });
        console.error(`[verdict] ${r.verdict}`);
        console.error(`[rules]   ${r.triggeredRules.join(", ") || "(none)"}`);
        console.error(`[cost]    $${r.spentUsd.toFixed(2)}`);
        console.error(`[report]  ${r.reportPath} (workspace: ${r.workspace})`);
        console.error(`[next]    검토 후: harness apply --approved  (auto 는 apply 안 함)`);
        if (opts.strict) {
          const code = gateStrictExitCode(r.verdict);
          if (code !== 0) process.exit(code);
        }
      } catch (err) {
        const e = err as Error & { exitCode?: number };
        console.error(`[error] auto failed: ${e.message}`);
        process.exit(e.exitCode ?? 1);
      }
    });
}
```

- [ ] **Step 2: 등록**

`src/cli/index.ts` 에서 다른 `register*` 들 옆에:

```typescript
import { registerAuto } from "./commands/auto.js";
// ... program 구성부에서:
registerAuto(program);
```

- [ ] **Step 3: 수동 확인 (도움말)**

Run: `npm run build && node dist/src/cli/index.js auto --help`
Expected: `auto <goal>` 명령 + `--task/--adapter/--max-cost/--strict` 표시

- [ ] **Step 4: 커밋**

```bash
git add src/cli/commands/auto.ts src/cli/index.ts
git commit -m "feat(cli): harness auto 명령 — 자동 공장 진입점"
```

---

## Task 6: e2e — auto 한 바퀴

**Files:**
- Test: `tests/e2e/auto-skeleton.test.ts`

CLI 가 아니라 `runAuto` 를 fake 어댑터로 직접 호출(결정적). 기존 e2e 패턴은 `tests/e2e/t-sec.test.ts` 참조.

- [ ] **Step 1: 테스트 작성**

```typescript
// tests/e2e/auto-skeleton.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAuto } from "../../src/core/auto/index.js";

const passReview = { id: "fake-codex", async available() { return true; },
  async run() { return { adapterId: "fake-codex", status: "passed" as const, findings: [] }; } };
const fakeWorker = { id: "fake", estimateCostUsd: 0.1, async available() { return true; },
  async dispatch() { return { status: "completed" as const, resultMd: "impl" }; } };

test("e2e auto: 클린 diff → 게이트 도달 + verdict + apply 미수행", async () => {
  const r = await runAuto({
    goal: "작은 기능", taskId: "TASK-001", maxCostUsd: 5,
    workerAdapter: fakeWorker, reviewAdapter: passReview,
    captureDiff: () => "diff --git a/src/x.ts b/src/x.ts\n--- a/src/x.ts\n+++ b/src/x.ts\n@@\n+export const x = 1;\n"
  });
  assert.equal(r.applied, false);
  assert.ok(r.verdict.length > 0);
});

test("e2e auto: secret 심은 diff → BLOCK (게이트가 막음, apply 불가)", async () => {
  const r = await runAuto({
    goal: "위험 변경", taskId: "TASK-001", maxCostUsd: 5,
    workerAdapter: fakeWorker, reviewAdapter: passReview,
    captureDiff: () => "diff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@\n+const key = process.env.API_KEY || \"sk-hardcoded-fallback\";\n"
  });
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.applied, false);
});

test("e2e auto: max-cost 0 → AI 호출 전 중단", async () => {
  await assert.rejects(() => runAuto({
    goal: "x", taskId: "TASK-001", maxCostUsd: 0,
    workerAdapter: fakeWorker, reviewAdapter: passReview, captureDiff: () => ""
  }), /상한|CostExceeded/);
});
```

- [ ] **Step 2: 실행 → 통과 확인**

Run: `node --test --import tsx tests/e2e/auto-skeleton.test.ts`
Expected: PASS (3 tests). BLOCK 테스트가 다른 verdict 면 `secret-fallback` 룰 트리거 diff 형식을 `tests/` 의 기존 secret fixture 와 맞춘다.

- [ ] **Step 3: 전체 게이트 통과 확인**

Run: `npm run verify` (typecheck + lint + depcheck + test)
Expected: 전부 통과, 기존 323 + 신규 테스트 포함.

- [ ] **Step 4: 커밋**

```bash
git add tests/e2e/auto-skeleton.test.ts
git commit -m "test(auto): e2e — 한 바퀴/BLOCK/cost-guard"
```

---

## Task 7: 실제 어댑터 수동 smoke (AC5 — 자동 아님)

**Files:** 없음(수동 절차 + 결과 기록).

라이브 claude/codex 는 비결정·비용·CI claude.exe 부재라 자동 테스트 안 함. **본인 PC에서 1회 수동 확인.**

- [ ] **Step 1: claude/codex CLI 가용 확인**

Run: `claude --version` 그리고 `codex --version`
Expected: 둘 다 버전 출력(codex 가 Windows 에서 spawn 되는지 = SH-006 해결 실측). 안 되면 `--adapter codex-stub` 로 review 대체하고 codex 는 별도 트러블슈팅.

- [ ] **Step 2: 작은 실제 목표로 auto 실행**

작은 throwaway git repo 에서:
Run: `node dist/src/cli/index.js auto "README 에 한 줄 추가" --task TASK-001 --max-cost 2`
Expected: claude 가 실제 파일 편집 → diff 캡처 → codex 검수 → `[verdict] ...` + `[cost] $...` + `[next] harness apply --approved`. **apply 는 자동 안 됨**(직접 확인).

- [ ] **Step 3: 결과를 RELEASE-NOTES 또는 examples 에 기록**

`docs/RELEASE-NOTES.md` 또는 `examples/` 에 smoke 결과 1건(verdict/cost/스크린샷) 기록 후 커밋. (AC5 증빙)

---

## Self-Review (스펙 대비)

- **AC1**(한 줄 자동 진행) → Task 4 `runAuto` + Task 5 CLI. ✓
- **AC2**(work 에서 diff 생성→gate) → Task 4(work→captureDiff→gate) + Task 6 e2e. ✓
- **AC2b**(프롬프트 맥락 주입) → Task 3. ✓
- **AC3**(Human Gate 정지, 자동 apply 없음) → Task 4(`applied:false`, onApply 미호출) + Task 6. ✓
- **AC4**(max-cost 초과 사전 중단) → Task 1 + Task 4 + Task 6. ✓
- **AC5**(실 claude/codex Windows smoke) → Task 7. ✓
- **AC6**(전체 게이트 green) → Task 6 Step 3 `npm run verify`. ✓
- **codex 독립검수 자동** → Task 4(`runReview({adapters:[codex]})`) + Task 5(`--adapter codex` 기본). ✓

**미해결/실행 중 확인 필요(placeholder 아님, 실측 항목):**
- `runReview` 정확한 입력 형태 — `self-host.ts:185` 는 `{ adapters: [] }`. codex 어댑터를 배열에 넣어 전달(Task 4 Step 4 에서 시그니처 맞춤).
- `readGitDiff`/`diffHash` 위치 = `src/utils/git.ts`(self-host import 로 확인됨).
- 실사용 시 claude 가 *어느 cwd 에서* 파일을 편집하는지(워크스페이스 격리 vs 실 repo) — 스켈레톤은 captureDiff 주입으로 분리. 실 어댑터 cwd 배선은 Task 5/7 에서 확정.
