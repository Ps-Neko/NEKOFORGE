# NEKOFORGE `demo auto` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx nekoforge demo auto` 가 격리 환경에서 14-스테이션 자동 공장을 돌려 *목표→(캡처된 진짜)AI 코드→codex 리뷰→라이브 계산된 변조증거 verdict→Humans-decide 정지* 를 무료·오프라인·수초로 보여주고, `--real` 로 라이브 재실행한다.

**Architecture:** 자동화 엔진(`runAuto`, 14단계)·verdict 엔진(`runGate`)은 이미 존재한다. 기본 데모는 claude 를 spawn 하지 않는 **재생 워커 어댑터**가 *캡처된 AI diff* 를 공급하고, `runGate` 가 그 diff 에 verdict 를 **라이브 계산**한다. `--real` 모드만 실제 claude+codex 를 격리 샌드박스에서 구동한다. 신규 코드는 어댑터 1개 + 데모 시나리오 배선뿐.

**Tech Stack:** TypeScript(strict, ESM), commander(CLI), `node:test`+`node:assert/strict`(테스트), 기존 `runAuto`/`runGate`/`createCodexStubAdapter`/`createClaudeWorkerAdapter`/`createCodexRealAdapter`.

## Global Constraints

- **I1 — verdict 위조 금지:** 데모는 *AI 산출물(diff)*만 캡처한다. `verdict`/`triggeredRules` 는 매 실행 `runGate` 가 그 diff 에 라이브 계산한다.
- **I2 — 샌드박스 격리:** 재생/`--real` 모두 호출자 `process.cwd()` 를 변경하지 않는다. `--real` 의 claude worker cwd 는 전용 샌드박스여야 한다.
- **I3 — 모드 명시:** 기본 출력은 `재생(캡처된 실행)`, `--real` 은 `라이브` 로 표기. "라이브인 척" 금지.
- **I4 — apply 안전:** Human Gate 에서 정지. `runAuto` 의 `applied:false`·`onApply 미호출` 불변식 유지. 데모는 절대 실제 레포에 apply 하지 않는다.
- **오프라인 기본:** 기본 모드는 프로세스 spawn·네트워크·인증 0.
- 기존 패턴 준수: 어댑터는 주입형(`spawn` 주입)·`node:test`·commander 등록(`registerDemo`).
- 테스트 실행: `npm test` (= `node scripts/run-tests.mjs`, 전체 실행).

---

## File Structure

- **Create** `src/workers/adapters/replay.ts` — 재생 워커 어댑터(`createReplayWorkerAdapter`). spawn 없이 캡처 결과를 반환, `estimateCostUsd: 0`.
- **Create** `src/cli/demo-auto-diff.ts` — 캡처된 AI diff 상수(`AUTO_DEMO_DIFF`). 기존 인라인 `SAFETY_DIFF` 패턴과 동일. `--real` 로 재생성.
- **Modify** `src/cli/commands/demo.ts` — `auto` 시나리오 추가: `parseScenario` 확장, `runAutoDemo()`, `--real` 옵션, 내레이션.
- **Create** `tests/unit/workers/replay-adapter.test.ts` — 재생 어댑터 단위 테스트.
- **Create** `tests/integration/demo-auto.test.ts` — 오프라인 e2e·결정성·정직성·격리 테스트.

---

### Task 1: 재생 워커 어댑터 (replay WorkerAdapter)

**Files:**
- Create: `src/workers/adapters/replay.ts`
- Test: `tests/unit/workers/replay-adapter.test.ts`

**Interfaces:**
- Consumes: `WorkerAdapter`, `WorkerAdapterInput`, `WorkerAdapterResult` from `../adapter.js` (이미 존재).
  - `WorkerAdapterInput = { role: WorkerRole; prompt: string; taskId: string }`
  - `WorkerAdapterResult = { status: "completed"|"failed"|"skipped"|"needs_input"; resultMd: string; exitCode?: number; notes?: string }`
- Produces: `createReplayWorkerAdapter(opts?: { resultMd?: string }): WorkerAdapter & { estimateCostUsd: number }` — `id: "replay"`, `available()→true`, `dispatch()→{status:"completed", resultMd, notes:"replay (no spawn)"}`, `estimateCostUsd: 0`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/workers/replay-adapter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReplayWorkerAdapter } from "../../../src/workers/adapters/replay.js";

test("replay adapter: spawn 없이 completed + 캡처 resultMd 반환", async () => {
  const a = createReplayWorkerAdapter({ resultMd: "# captured worker output" });
  assert.equal(a.id, "replay");
  assert.equal(a.estimateCostUsd, 0);
  assert.equal(await a.available(), true);
  const r = await a.dispatch({ role: "implementation-worker", prompt: "ignored", taskId: "TASK-001" });
  assert.equal(r.status, "completed");
  assert.equal(r.resultMd, "# captured worker output");
  assert.equal(r.notes, "replay (no spawn)");
});

test("replay adapter: resultMd 기본값 제공", async () => {
  const a = createReplayWorkerAdapter();
  const r = await a.dispatch({ role: "implementation-worker", prompt: "x", taskId: "T" });
  assert.equal(r.status, "completed");
  assert.ok(r.resultMd.length > 0);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/workers/adapters/replay.js'`

- [ ] **Step 3: 최소 구현**

```ts
// src/workers/adapters/replay.ts
/**
 * 재생(replay) 워커 어댑터 — claude 를 spawn 하지 않고 *캡처된 AI 산출물*을 반환한다.
 * demo auto 의 결정적/오프라인 모드 전용. cost 0. (실제 코드 생성은 createClaudeWorkerAdapter.)
 */
import type { WorkerAdapter, WorkerAdapterInput, WorkerAdapterResult } from "../adapter.js";

export interface ReplayAdapterOptions {
  /** 데모에서 보여줄 워커 산출 요약(markdown). diff 자체는 runAuto 의 captureDiff 로 공급된다. */
  resultMd?: string;
}

export function createReplayWorkerAdapter(
  opts: ReplayAdapterOptions = {}
): WorkerAdapter & { estimateCostUsd: number } {
  const resultMd = opts.resultMd ?? "# replay worker\n\n캡처된 AI 작업을 재생합니다(실시간 호출 없음).";
  return {
    id: "replay",
    estimateCostUsd: 0,
    async available(): Promise<boolean> {
      return true;
    },
    async dispatch(_input: WorkerAdapterInput): Promise<WorkerAdapterResult> {
      return { status: "completed", resultMd, notes: "replay (no spawn)" };
    }
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (신규 2개 포함 전체 green)

- [ ] **Step 5: 커밋**

```bash
git add src/workers/adapters/replay.ts tests/unit/workers/replay-adapter.test.ts
git commit -m "feat(workers): replay 워커 어댑터 — spawn 없이 캡처 산출물 재생 (demo auto용)"
```

---

### Task 2: 캡처 diff 상수 + demo auto 오프라인 배선

**Files:**
- Create: `src/cli/demo-auto-diff.ts`
- Modify: `src/cli/commands/demo.ts` (parseScenario, runAutoDemo, registerDemo 옵션)
- Test: `tests/integration/demo-auto.test.ts`

**Interfaces:**
- Consumes: `runAuto` from `../../core/auto/index.js` (`AutoInput`/`AutoResult` 기존), `createReplayWorkerAdapter`(Task 1), `createCodexStubAdapter` from `../../integrations/codex/stub.js`, `AUTO_DEMO_DIFF`(이 Task).
- Produces: `runAutoDemo(opts: { taskId: string; real: boolean }): Promise<{ verdict: string; triggeredRules: string[]; spentUsd: number; report: string; mode: "재생"|"라이브" }>` — demo.ts 내부 export(테스트용). 기본(real=false)은 재생 모드.

- [ ] **Step 1: 캡처 diff 상수 작성 (부트스트랩 — Task 5에서 --real 로 교체)**

```ts
// src/cli/demo-auto-diff.ts
/**
 * demo auto 가 보여주는 "AI 가 짠 코드" diff.
 * 부트스트랩 = 대표 예시(실 claude 산출과 같은 형태). Task 5 에서 `demo auto --real` 로
 * 캡처한 진짜 diff 로 교체한다. verdict 는 이 diff 에 매번 runGate 가 라이브 계산한다(I1).
 */
export const AUTO_DEMO_DIFF = [
  "diff --git a/src/auth/login.ts b/src/auth/login.ts",
  "index 1111111..2222222 100644",
  "--- a/src/auth/login.ts",
  "+++ b/src/auth/login.ts",
  "@@ -1,5 +1,9 @@",
  " export interface LoginInput { email: string; password: string }",
  " ",
  " export function canLogin(input: LoginInput): boolean {",
  "-  return input.email.length > 0 && input.password.length >= 8;",
  "+  if (!input.email.includes(\"@\")) return false;",
  "+  if (input.password.length < 8) return false;",
  "+  return true;",
  " }",
  "+",
  "+export function isLocked(attempts: number): boolean {",
  "+  return attempts >= 5;",
  "+}"
].join("\n") + "\n";
```

- [ ] **Step 2: 실패하는 통합 테스트 작성**

```ts
// tests/integration/demo-auto.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoDemo } from "../../src/cli/commands/demo.js";

test("demo auto (재생): 오프라인으로 verdict 라이브 계산", async () => {
  const cwdBefore = process.cwd();
  const r = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(r.mode, "재생");
  assert.ok(["PASS", "REVIEW", "BLOCK", "INSUFFICIENT"].includes(r.verdict), `verdict=${r.verdict}`);
  assert.equal(typeof r.report, "string");
  assert.equal(r.spentUsd, 0, "재생은 비용 0");
  assert.equal(process.cwd(), cwdBefore, "I2: cwd 불변");
});

test("demo auto (재생): 결정성 — 두 번 돌려도 같은 verdict/rules", async () => {
  const a = await runAutoDemo({ taskId: "TASK-001", real: false });
  const b = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(a.verdict, b.verdict);
  assert.deepEqual(a.triggeredRules, b.triggeredRules);
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `runAutoDemo` export 없음

- [ ] **Step 4: demo.ts 에 배선 구현**

`src/cli/commands/demo.ts` 상단 import 에 추가:
```ts
import { runAuto } from "../../core/auto/index.js";
import { createReplayWorkerAdapter } from "../../workers/adapters/replay.js";
import { createClaudeWorkerAdapter } from "../../workers/adapters/claude.js";
import { createCodexRealAdapter } from "../../integrations/codex/real.js";
import { AUTO_DEMO_DIFF } from "../demo-auto-diff.js";
import { mkdtemp } from "node:fs/promises";
```
*(주의: `mkdtemp`·`createCodexStubAdapter`·`tmpdir`·`join` 은 demo.ts 에 이미 import 됨 — 중복 추가하지 말 것.)*

`parseScenario` 의 타입과 분기 확장:
```ts
type DemoScenario = "safety" | "productivity" | "auto";

function parseScenario(raw: string | undefined): DemoScenario {
  const scenario = raw ?? "safety";
  if (scenario === "safety" || scenario === "productivity" || scenario === "auto") return scenario;
  throw new Error(`unknown demo scenario: ${scenario}. Expected safety, productivity, or auto`);
}
```

`runAutoDemo` 함수 추가(파일 내, `registerDemo` 위):
```ts
export async function runAutoDemo(
  opts: { taskId: string; real: boolean }
): Promise<{ verdict: string; triggeredRules: string[]; spentUsd: number; report: string; mode: "재생" | "라이브" }> {
  const mode = opts.real ? "라이브" : "재생";
  // --real: 격리 샌드박스(git repo)에서 실제 claude 가 편집. 재생: 캡처 diff 공급(편집 0).
  const sandbox = await mkdtemp(join(tmpdir(), "nekoforge-demo-auto-"));
  const workerAdapter = opts.real
    ? createClaudeWorkerAdapter({ cwd: sandbox, permissionMode: "acceptEdits" })
    : createReplayWorkerAdapter({ resultMd: "# implementation-worker\n\n캡처된 AI 산출물(검증 추가 + isLocked).\n" });
  const reviewAdapter = opts.real ? createCodexRealAdapter() : createCodexStubAdapter({ enabled: true });
  const captureDiff = opts.real
    ? () => readGitDiff(sandbox) ?? ""
    : () => AUTO_DEMO_DIFF;

  const r = await runAuto({
    goal: "Add input validation and a lockout helper to the login module, with tests",
    taskId: opts.taskId,
    maxCostUsd: opts.real ? 5 : 0,
    workerAdapter,
    reviewAdapter,
    captureDiff
  });
  return {
    verdict: r.verdict,
    triggeredRules: r.triggeredRules,
    spentUsd: r.spentUsd,
    report: r.report,
    mode
  };
}
```
*(`readGitDiff` 는 demo.ts 에 아직 import 안 됨 — `--real` 경로를 Task 3 에서 마저 배선하므로, 이 Task 에서는 import 추가 + 위 코드 그대로 두면 재생 경로만 타서 테스트 통과한다. `readGitDiff` import 추가:)*
```ts
import { readGitDiff } from "../../utils/git.js";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (demo-auto 재생 2 케이스 + 전체 green)

- [ ] **Step 6: 커밋**

```bash
git add src/cli/demo-auto-diff.ts src/cli/commands/demo.ts tests/integration/demo-auto.test.ts
git commit -m "feat(demo): demo auto 재생 모드 — 캡처 diff에 verdict 라이브 계산 (오프라인)"
```

---

### Task 3: CLI `auto` 시나리오 등록 + 내레이션 + `--real` 옵션

**Files:**
- Modify: `src/cli/commands/demo.ts` (`registerDemo` 액션, 내레이션 출력)
- Test: `tests/integration/demo-auto.test.ts` (출력/모드 라벨 추가)

**Interfaces:**
- Consumes: `runAutoDemo`(Task 2).
- Produces: `demo auto [--real] [--task <id>]` CLI 경로. 내레이션은 `console.error` 로 스테이지/verdict/룰/모드/게이트정지 메시지 출력.

- [ ] **Step 1: 정직성 라벨 테스트 추가**

```ts
// tests/integration/demo-auto.test.ts 에 append
test("demo auto (재생): 출력은 '재생'으로 표기, '라이브' 주장 안 함 (I3)", async () => {
  const r = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(r.mode, "재생");
});
```

- [ ] **Step 2: 테스트 실패/통과 확인 (이미 mode 반환하므로 통과 기대)**

Run: `npm test`
Expected: PASS (이 라벨 단언은 Task 2 구현으로 이미 충족 — 회귀 가드)

- [ ] **Step 3: registerDemo 에 auto 분기 + 내레이션 구현**

`registerDemo` 의 description/argument 갱신 + `--real` 옵션 + auto 분기:
```ts
program
    .command("demo")
    .description("Run an isolated NEKOFORGE demo (safety, productivity, or auto).")
    .argument("[scenario]", "safety | productivity | auto", "safety")
    .option("--task <id>", "task id", "TASK-001")
    .option("--clean", "remove the temporary demo workspace after printing the result", false)
    .option("--real", "auto 시나리오를 실제 claude+codex 로 라이브 실행(인증 필요)", false)
    .action(async (scenarioRaw: string | undefined, opts: DemoOpts & { real?: boolean }) => {
      const scenario = parseScenario(scenarioRaw);
      const taskId = opts.task ?? "TASK-001";
      if (scenario === "auto") {
        await runAutoDemoCli(taskId, opts.real === true);
      } else if (scenario === "productivity") {
        await runProductivityDemo(taskId, opts.clean === true);
      } else {
        await runSafetyDemo(taskId, opts.clean === true);
      }
    });
```

내레이션 래퍼 추가(파일 내):
```ts
async function runAutoDemoCli(taskId: string, real: boolean): Promise<void> {
  try {
    console.error(`[demo]    nekoforge 자동 공장 (${real ? "라이브" : "재생"} 모드)`);
    console.error(`[goal]    login 모듈에 입력 검증 + lockout 헬퍼 추가`);
    console.error(`[stages]  intake→clarify→context→spec→plan→design→policy→team→contract→work→review→gate`);
    const r = await runAutoDemo({ taskId, real });
    console.error(`[work]    AI 코드 산출 (${real ? "claude 라이브" : "캡처 재생"})`);
    console.error(`[review]  codex 독립 리뷰 (${real ? "라이브" : "stub"})`);
    console.error(`[verdict] ${r.verdict}   (rules: ${r.triggeredRules.join(", ") || "none"})`);
    console.error(`[cost]    $${r.spentUsd.toFixed(2)}`);
    console.error(`[gate]    ⏸ 여기서 멈춥니다 — Humans decide. NEKOFORGE 는 자동 apply 하지 않습니다.`);
    console.error(`[next]    검토 후 적용은 사람이: 'nekoforge apply --approved' (데모는 실제 레포에 적용 안 함)`);
    if (r.report) console.log(r.report);
  } catch (err) {
    const e = err as Error & { exitCode?: number };
    console.error(`[error] demo auto failed: ${e.message}`);
    if (real) console.error(`[hint]  --real 은 claude+codex 인증이 필요합니다. 인증 없이 기본(재생)으로 실행해 보세요.`);
    process.exit(e.exitCode ?? 1);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체 green)

- [ ] **Step 5: 수동 스모크 (재생, 오프라인)**

Run: `npx tsx src/cli/index.ts demo auto`
Expected: 스테이지/verdict/`⏸ Humans decide`/REPORT 본문 출력, 종료 코드 0, claude/codex 미호출.

- [ ] **Step 6: 커밋**

```bash
git add src/cli/commands/demo.ts tests/integration/demo-auto.test.ts
git commit -m "feat(demo): demo auto CLI 시나리오 + 내레이션 + --real 옵션 (오프라인 기본)"
```

---

### Task 4: 격리 불변식 가드 테스트 (I2/I4)

**Files:**
- Test: `tests/integration/demo-auto.test.ts` (append)

**Interfaces:**
- Consumes: `runAutoDemo`(Task 2).

- [ ] **Step 1: 격리·apply-안전 테스트 작성**

```ts
// tests/integration/demo-auto.test.ts 에 append
import { mkdtemp, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("demo auto (재생): 호출자 cwd 파일을 생성/변경하지 않음 (I2)", async () => {
  const probe = await mkdtemp(join(tmpdir(), "nf-demo-probe-"));
  const sentinel = join(probe, "sentinel.txt");
  await writeFile(sentinel, "untouched", "utf8");
  const before = await readdir(probe);
  const orig = process.cwd();
  process.chdir(probe);
  try {
    await runAutoDemo({ taskId: "TASK-001", real: false });
  } finally {
    process.chdir(orig);
  }
  const after = await readdir(probe);
  assert.deepEqual(after, before, "I2: 데모가 cwd 에 파일을 만들지 않음");
});
```

- [ ] **Step 2: 테스트 실행**

Run: `npm test`
Expected: PASS (runAuto 는 자체 tmp ws 사용, 재생은 편집 0 → cwd 불변)

- [ ] **Step 3: 커밋**

```bash
git add tests/integration/demo-auto.test.ts
git commit -m "test(demo): demo auto 격리 불변식 가드 (cwd 불변)"
```

---

### Task 5: 진짜 캡처로 fixture 교체 + 시나리오 문서 (제작자 단계)

> ⚠️ 이 Task 는 `claude` + `codex` CLI 인증이 된 환경(제작자)에서 수행한다. 인증이 없으면 Task 1~4 까지가 완성된 오프라인 데모이며, 이 Task 는 보류 가능.

**Files:**
- Modify: `src/cli/demo-auto-diff.ts` (`AUTO_DEMO_DIFF` 를 라이브 캡처로 교체)
- Create: `examples/demo-auto/README.md`

**Interfaces:** 없음(자산 교체).

- [ ] **Step 1: 라이브 1회 실행으로 진짜 diff 캡처**

Run: `npx tsx src/cli/index.ts demo auto --real`
Expected: claude 가 샌드박스에서 코드 작성 → codex 리뷰 → verdict 출력. 콘솔의 `[report]` 본문과 함께, 라이브 diff 가 필요하면 `--real` 경로의 `readGitDiff(sandbox)` 결과를 로깅해 확보(필요 시 임시 `console.log(captureDiff())` 한 줄로 덤프 후 제거).

- [ ] **Step 2: 캡처한 diff 로 상수 교체**

`src/cli/demo-auto-diff.ts` 의 `AUTO_DEMO_DIFF` 를 Step 1 에서 얻은 *실제* unified diff 문자열로 교체. (부트스트랩 대표 diff 삭제.)

- [ ] **Step 3: 결정성 스냅샷 재확인**

Run: `npm test`
Expected: PASS. (verdict/rules 가 바뀌면 `demo-auto.test.ts` 의 결정성 테스트는 여전히 통과해야 함 — 값이 아니라 *재현성*을 단언하므로.)

- [ ] **Step 4: 시나리오 문서 작성**

```markdown
<!-- examples/demo-auto/README.md -->
# demo auto — 결정적 자동공장 데모

`npx nekoforge demo auto` 는 NEKOFORGE 자동 공장 한 바퀴를 보여준다:
목표 → AI 코드(캡처 재생) → codex 리뷰 → **라이브 계산된 변조증거 verdict** → Humans-decide 정지.

- 기본: 오프라인·무료·수초. AI diff 는 캡처본을 재생하지만 **verdict 는 매번 실제 엔진이 계산**한다(위조 없음).
- `--real`: 실제 claude+codex 로 라이브 실행(인증 필요). 캡처본 갱신에 사용.
- 데모는 호출자 레포를 절대 건드리지 않고, 게이트에서 멈춘다(자동 apply 없음).

캡처 diff 갱신: `npx tsx src/cli/index.ts demo auto --real` → 결과 diff 를 `src/cli/demo-auto-diff.ts` 의 `AUTO_DEMO_DIFF` 에 반영.
```

- [ ] **Step 5: 커밋**

```bash
git add src/cli/demo-auto-diff.ts examples/demo-auto/README.md
git commit -m "feat(demo): demo auto 진짜 캡처 diff 반영 + 시나리오 문서"
```

---

## Self-Review

**1. Spec coverage:**
- §1 결정사항(목적/형태/모드 A) → Task 2·3 (재생 기본 + --real). ✅
- §2 I1 verdict 위조금지 → Task 2(runGate 라이브 계산), demo-auto-diff 주석. ✅
- §2 I2 격리 → Task 4 가드 테스트. ✅
- §2 I3 모드 명시 → Task 2 `mode` 반환 + Task 3 내레이션 라벨 + 정직성 테스트. ✅
- §2 I4 apply 안전 → Task 3 게이트 정지 메시지, runAuto applied:false(엔진 불변식). ✅
- §3.2 신규 3개(replay 어댑터/시나리오 자산/배선) → Task 1/Task 2·5/Task 3. ✅
- §4 데이터 흐름(runAuto+replay+stub+captureDiff) → Task 2. ✅
- §5 에러 처리(--real 미인증 안내) → Task 3 catch hint. ✅
- §6 테스트(replay·오프라인 e2e·결정성·정직성·격리) → Task 1/2/3/4. ✅
- §8 미결정(샌드박스+goal, codex fixture vs stub, 내레이션 카피) → Task 2 goal 고정·codex-stub 채택·Task 3 카피로 해소. ✅

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 스텝에 실제 코드 포함. (Task 5 Step 1 의 diff 캡처는 *런타임 산출물*이라 값 고정 불가가 정상 — 절차로 명시.)

**3. Type consistency:** `createReplayWorkerAdapter`(Task 1) ↔ Task 2 사용 일치. `runAutoDemo` 시그니처(Task 2) ↔ Task 3·4 사용 일치. `WorkerAdapterResult` 필드(status/resultMd/notes) 실제 인터페이스와 일치. `runAuto` 입력(goal/taskId/maxCostUsd/workerAdapter/reviewAdapter/captureDiff) 실제 `AutoInput` 과 일치. ✅
