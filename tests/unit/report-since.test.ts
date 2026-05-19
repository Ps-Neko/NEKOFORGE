/**
 * Phase 후속 — report --since 옵션 단위 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReport, ReportInvalidStageError } from "../../src/core/report/index.js";
import { buildDeps } from "../../src/core/stage-runner.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-report-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function seedStages(dir: string, files: string[]): Promise<void> {
  await mkdir(join(dir, ".harness"), { recursive: true });
  for (const f of files) {
    await writeFile(join(dir, ".harness", f), "seed\n", "utf8");
  }
}

test("report --since: returns only stages on/after given stage", async () => {
  await inTmp(async (dir) => {
    await seedStages(dir, [
      "intake.md",
      "clarify.md",
      "context.md",
      "SPEC.md",
      "TASKS.md",
      "harness-design.md",
      "quality-policy.md",
      "agent-routing.json",
      "worklog.md"
    ]);
    const snap = await runReport(buildDeps(dir), { since: "harness-design" });
    assert.deepEqual(snap.stagesPresent, [
      "harness-design",
      "quality-policy",
      "team",
      "work"
    ]);
  });
});

test("report --since: full list when no since given", async () => {
  await inTmp(async (dir) => {
    await seedStages(dir, ["intake.md", "clarify.md"]);
    const snap = await runReport(buildDeps(dir));
    assert.deepEqual(snap.stagesPresent, ["intake", "clarify"]);
  });
});

test("report --since: unknown stage throws ReportInvalidStageError", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => runReport(buildDeps(dir), { since: "nonexistent" }),
      ReportInvalidStageError
    );
  });
});
