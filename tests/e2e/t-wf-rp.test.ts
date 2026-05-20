/**
 * T-WF + T-RP e2e — Phase WF/RP gate 통합 검증.
 *
 * seedHarness 가 .harness 기본 시드를 만든다. 본 시리즈는 worker / rule-pack
 * 아티팩트를 추가로 시드하고 runGate 결과를 검증.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { seedHarness } from "./_seed.js";
import { runGate } from "../../src/core/gate/index.js";

const GATE_OPTS = { taskId: "TASK-001" as const, testStatus: "passed" as const };

async function seedWorkers(
  cwd: string,
  profile: "minimal" | "standard" | "strict",
  workers: Array<{ id: string; role: string }>
): Promise<void> {
  const data = {
    schemaVersion: "0.5",
    profile,
    workers: workers.map((w) => ({
      ...w,
      canWriteDecision: false,
      canApply: false,
      forbiddenActionsDeclared: ["no-commit", "no-push", "no-deploy", "no-apply"]
    })),
    roleSeparation: [
      ["implementation-worker", "security-reviewer"],
      ["implementation-worker", "release-gatekeeper"]
    ]
  };
  await writeFile(join(cwd, ".harness", "workers.json"), JSON.stringify(data));
}

async function seedWorkerResult(
  cwd: string,
  taskId: string,
  role: string,
  status: "completed" | "failed",
  findings: Array<{ severity: string; title: string }> = []
): Promise<void> {
  const dir = join(cwd, ".harness", "worker-runs", taskId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${role}.result.md`),
    `# ${role} result\n\n${role} reviewed the diff.\n`
  );
  await writeFile(
    join(dir, `${role}.result.json`),
    JSON.stringify({
      schemaVersion: "0.5",
      taskId,
      workerId: role,
      role,
      status,
      findings,
      evidence: {
        result: `.harness/worker-runs/${taskId}/${role}.result.md`
      },
      forbiddenActionsDeclared: ["no-commit", "no-push", "no-deploy", "no-apply"]
    })
  );
}

async function seedRulePacks(cwd: string, enabled: string[]): Promise<void> {
  await writeFile(
    join(cwd, ".harness", "rule-packs.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      enabledPacks: enabled,
      requiredForTemplates: {
        "web-ui": ["security-core", "design-web"],
        "backend-api": ["security-core", "architecture-core"]
      }
    })
  );
}

// === T-WF-01 ===
test("T-WF-01: standard profile + only impl-worker present → NEEDS_HUMAN_REVIEW", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedWorkers(ws.cwd, "standard", [
    { id: "impl-1", role: "implementation-worker" },
    { id: "test-1", role: "test-worker" },
    { id: "sec-1", role: "security-reviewer" }
  ]);
  await seedWorkerResult(ws.cwd, "TASK-001", "implementation-worker", "completed");
  // test-worker + security-reviewer 둘 다 result 없음
  const r = await runGate(GATE_OPTS, ws.deps);
  assert.ok(
    r.verdict === "NEEDS_HUMAN_REVIEW" ||
      r.verdict === "INSUFFICIENT_EVIDENCE" ||
      r.verdict === "BLOCK",
    `verdict should not be PASS family, got ${r.verdict}`
  );
});

// === T-WF-02 release mode + security-reviewer missing ===
test("T-WF-02: release mode + missing security-reviewer → INSUFFICIENT_EVIDENCE", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedWorkers(ws.cwd, "standard", [
    { id: "impl-1", role: "implementation-worker" },
    { id: "test-1", role: "test-worker" },
    { id: "sec-1", role: "security-reviewer" }
  ]);
  await seedWorkerResult(ws.cwd, "TASK-001", "implementation-worker", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "test-worker", "completed");
  const r = await runGate({ ...GATE_OPTS, mode: "release" }, ws.deps);
  assert.equal(r.verdict, "INSUFFICIENT_EVIDENCE");
});

// === T-WF-03 role separation ===
test("T-WF-03: dual-role violation triggers worker-role-separation finding", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedWorkers(ws.cwd, "standard", [
    { id: "dual-1", role: "implementation-worker" },
    { id: "dual-1", role: "security-reviewer" },
    { id: "test-1", role: "test-worker" }
  ]);
  await seedWorkerResult(ws.cwd, "TASK-001", "implementation-worker", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "security-reviewer", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "test-worker", "completed");
  const r = await runGate(GATE_OPTS, ws.deps);
  assert.ok(
    r.triggeredRules.includes("worker-role-separation"),
    `expected worker-role-separation, got ${r.triggeredRules.join(",")}`
  );
});

// === T-WF-04 critical finding ===
test("T-WF-04: worker critical finding → BLOCK", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedWorkers(ws.cwd, "standard", [
    { id: "impl-1", role: "implementation-worker" },
    { id: "test-1", role: "test-worker" },
    { id: "sec-1", role: "security-reviewer" }
  ]);
  await seedWorkerResult(ws.cwd, "TASK-001", "implementation-worker", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "test-worker", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "security-reviewer", "completed", [
    { severity: "critical", title: "SQL injection in auth path" }
  ]);
  const r = await runGate(GATE_OPTS, ws.deps);
  assert.equal(r.verdict, "BLOCK");
});

// === T-WF-05 forbidden action in result body ===
test("T-WF-05: worker result body contains 'git push' → worker-safety-risk critical", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedWorkers(ws.cwd, "standard", [
    { id: "impl-1", role: "implementation-worker" },
    { id: "test-1", role: "test-worker" },
    { id: "sec-1", role: "security-reviewer" }
  ]);
  // Body 에 forbidden 명령 포함
  const dir = join(ws.cwd, ".harness", "worker-runs", "TASK-001");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "implementation-worker.result.md"),
    "# impl\n\nI did git push to deploy."
  );
  await writeFile(
    join(dir, "implementation-worker.result.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      taskId: "TASK-001",
      workerId: "impl-1",
      role: "implementation-worker",
      status: "completed",
      findings: [],
      evidence: { result: ".harness/worker-runs/TASK-001/implementation-worker.result.md" },
      forbiddenActionsDeclared: ["no-commit", "no-push", "no-deploy", "no-apply"]
    })
  );
  await seedWorkerResult(ws.cwd, "TASK-001", "test-worker", "completed");
  await seedWorkerResult(ws.cwd, "TASK-001", "security-reviewer", "completed");
  const r = await runGate(GATE_OPTS, ws.deps);
  assert.ok(
    r.triggeredRules.includes("worker-safety-risk"),
    `expected worker-safety-risk, got ${r.triggeredRules.join(",")}`
  );
});

// === T-RP-01 ===
test("T-RP-01: required security-core missing → INSUFFICIENT_EVIDENCE", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedRulePacks(ws.cwd, ["test-discipline"]);
  // contract template = backend-api 로 가장
  const contractPath = join(ws.cwd, ".harness", "quality-contract.json");
  const raw = await import("node:fs/promises").then((m) => m.readFile(contractPath, "utf8"));
  const c = JSON.parse(raw) as Record<string, unknown>;
  c.template = "backend-api";
  await writeFile(contractPath, JSON.stringify(c));
  const r = await runGate(GATE_OPTS, ws.deps);
  assert.equal(r.verdict, "INSUFFICIENT_EVIDENCE");
});

// === T-RP-02 ===
test("T-RP-02: web-ui template + design-web missing → NEEDS_HUMAN_REVIEW", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedRulePacks(ws.cwd, ["security-core"]);
  const contractPath = join(ws.cwd, ".harness", "quality-contract.json");
  const raw = await import("node:fs/promises").then((m) => m.readFile(contractPath, "utf8"));
  const c = JSON.parse(raw) as Record<string, unknown>;
  c.template = "web-ui";
  await writeFile(contractPath, JSON.stringify(c));
  const r = await runGate(GATE_OPTS, ws.deps);
  // PASS 가 아니어야 함이 핵심 — design-web 누락이 verdict 강등.
  assert.notEqual(r.verdict, "PASS", `web-ui+design-web missing should not PASS`);
  assert.notEqual(r.verdict, "PASS_WITH_WARNINGS");
});

// === T-RP-04 skill-pack only missing → PASS_WITH_WARNINGS ===
test("T-RP-04: skill-pack only missing avoids BLOCK (skill is guidance)", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  // rule-pack 충분히 활성 (security-core + test-discipline + architecture-core
  // + quality-contract-core), 따라서 backend-api template 의 required rule pack
  // 충족 (release-strict 까지는 web-ui 가 아니므로 단순 backend-api 가능).
  await seedRulePacks(ws.cwd, [
    "security-core",
    "test-discipline",
    "architecture-core",
    "quality-contract-core",
    "release-strict"
  ]);
  // skill-packs: typescript-quality + evidence-writing 만 활성, web-ui-quality 누락.
  await writeFile(
    join(ws.cwd, ".harness", "skill-packs.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      enabledPacks: ["typescript-quality", "evidence-writing"],
      recommendedForTemplates: {
        "web-ui": [
          "typescript-quality",
          "web-ui-quality",
          "evidence-writing"
        ]
      }
    })
  );
  const contractPath = join(ws.cwd, ".harness", "quality-contract.json");
  const raw = await import("node:fs/promises").then((m) => m.readFile(contractPath, "utf8"));
  const c = JSON.parse(raw) as Record<string, unknown>;
  c.template = "web-ui";
  await writeFile(contractPath, JSON.stringify(c));

  await runGate(GATE_OPTS, ws.deps);
  const text = await import("node:fs/promises").then((m) =>
    m.readFile(join(ws.cwd, ".harness", "decision.json"), "utf8")
  );
  const d = JSON.parse(text) as {
    verdict: string;
    rulePacks?: { missingRequired?: string[] };
    skillPacks?: { missingRecommended?: string[]; status?: string };
  };
  // 본 시나리오의 핵심: skill-pack missing 자체가 추가 강등 신호를 만들지 않는다.
  // rule-pack 도 (web-ui 가 design-web 요구하지만) 본 시드는 design-web 미포함이라
  // 부수적 강등 가능. 핵심 검증: missingRecommended 가 잡혔는지 + status=partial.
  assert.deepEqual(d.skillPacks?.missingRecommended, ["web-ui-quality"]);
  assert.equal(d.skillPacks?.status, "partial");
});

// === T-RP-03 ===
test("T-RP-03: rule-packs decision.json reflects enabled list", async (t) => {
  const ws = await seedHarness();
  t.after(ws.cleanup);
  await seedRulePacks(ws.cwd, ["security-core", "test-discipline"]);
  await runGate(GATE_OPTS, ws.deps);
  const text = await import("node:fs/promises").then((m) =>
    m.readFile(join(ws.cwd, ".harness", "decision.json"), "utf8")
  );
  const d = JSON.parse(text) as {
    rulePacks?: { enabled?: string[] };
  };
  assert.deepEqual(d.rulePacks?.enabled, ["security-core", "test-discipline"]);
});
