/**
 * Phase QF — Quality Contract + Quality Score 회귀 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runQualityContract,
  ContractPrecondError,
  ContractCheckError
} from "../../src/core/quality-contract/index.js";
import {
  calculateQualityScore,
  verdictHintFromScore
} from "../../src/scoring/index.js";
import { runWork, WorkPrecondError } from "../../src/core/work/index.js";
import { buildDeps } from "../../src/core/stage-runner.js";
import { createValidator } from "../../src/schemas/loader.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-qf-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function seedForContract(dir: string): Promise<void> {
  await mkdir(join(dir, ".harness"), { recursive: true });
  await writeFile(join(dir, ".harness", "SPEC.md"), "# SPEC\n", "utf8");
}

test("contract: requires SPEC.md before creation", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => runQualityContract({ template: "custom" }, buildDeps(dir)),
      ContractPrecondError
    );
  });
});

test("contract: creates schema-valid quality-contract.json", async () => {
  await inTmp(async (dir) => {
    await seedForContract(dir);
    const r = await runQualityContract(
      { template: "backend-api", taskId: "TASK-001" },
      buildDeps(dir)
    );
    assert.match(r.jsonPath, /quality-contract\.json/);
    const data = JSON.parse(
      await readFile(join(dir, ".harness", "quality-contract.json"), "utf8")
    );
    const v = createValidator();
    const result = v.validate("quality-contract", data);
    assert.ok(result.valid, result.errors.join("; "));
    assert.equal(data.template, "backend-api");
    assert.equal(data.qualityBars.security.minimum, 95);
  });
});

test("contract --check: missing contract → ContractCheckError", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => runQualityContract({ check: true }, buildDeps(dir)),
      ContractCheckError
    );
  });
});

test("work: rejects when quality-contract.json missing", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await writeFile(join(dir, ".harness", "TASKS.md"), "TASK-001\n", "utf8");
    await writeFile(
      join(dir, ".harness", "agent-routing.json"),
      JSON.stringify({ schemaVersion: "0.3", routes: [] }),
      "utf8"
    );
    await assert.rejects(
      () => runWork({ taskId: "TASK-001" }, buildDeps(dir)),
      WorkPrecondError
    );
  });
});

test("score: clean inputs → high overall", () => {
  const r = calculateQualityScore({
    findings: [],
    testStatus: "passed",
    reviewStatus: "passed",
    evidenceComplete: true,
    qualityBars: {
      correctness: { minimum: 80, required: true },
      security: { minimum: 90, required: true }
    },
    taskId: "T"
  });
  assert.ok(r.scores.overall >= 85, `overall=${r.scores.overall}`);
});

test("score: security finding → low security score + required failure", () => {
  const r = calculateQualityScore({
    findings: [
      {
        ruleId: "secret-fallback",
        severity: "critical",
        message: "x"
      }
    ],
    testStatus: "passed",
    reviewStatus: "passed",
    evidenceComplete: true,
    qualityBars: {
      security: { minimum: 90, required: true }
    },
    taskId: "T"
  });
  assert.ok(r.scores.security < 60);
  assert.ok(r.failedQualityBars.some((s) => s.startsWith("security:")));
});

test("verdictHintFromScore: required failure → cap NEEDS_HUMAN_REVIEW", () => {
  const r = calculateQualityScore({
    findings: [{ ruleId: "x", severity: "high", message: "" }],
    testStatus: "passed",
    reviewStatus: "passed",
    evidenceComplete: true,
    qualityBars: { correctness: { minimum: 100, required: true } },
    taskId: "T"
  });
  const hint = verdictHintFromScore(r, true);
  assert.equal(hint.capAt, "NEEDS_HUMAN_REVIEW");
});

test("verdictHintFromScore: overall < 60 → NEEDS_HUMAN_REVIEW", () => {
  const r = calculateQualityScore({
    findings: Array.from({ length: 8 }, () => ({
      ruleId: "no-test-risk",
      severity: "warning" as const,
      message: "x"
    })),
    testStatus: "failed",
    reviewStatus: "failed",
    evidenceComplete: false,
    qualityBars: {},
    taskId: "T"
  });
  const hint = verdictHintFromScore(r, false);
  assert.ok(
    hint.capAt === "NEEDS_HUMAN_REVIEW" || hint.capAt === "PASS_WITH_WARNINGS",
    `unexpected cap: ${hint.capAt}`
  );
});
