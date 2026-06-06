/**
 * Fix #3 regression guard — taskId is used in a RegExp to check TASKS.md.
 * A taskId like '.*' could match any content, bypassing the task-existence check.
 * After the fix, regex-special characters in taskId must be escaped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWork, WorkPrecondError, WorkDuplicateError } from "../../src/core/work/index.js";
import { buildDeps } from "../../src/core/stage-runner.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-work-re-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Minimal harness setup: TASKS.md + agent-routing.json + quality-contract.json. */
async function seedMinimal(dir: string, tasksContent: string): Promise<void> {
  await mkdir(join(dir, ".harness"), { recursive: true });
  await writeFile(join(dir, ".harness", "TASKS.md"), tasksContent, "utf8");
  await writeFile(
    join(dir, ".harness", "agent-routing.json"),
    JSON.stringify({ schemaVersion: "0.3", routes: [] }),
    "utf8"
  );
  // quality-contract.json with valid productIntent (required since work stage QF check)
  await writeFile(
    join(dir, ".harness", "quality-contract.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      taskId: "TASK-001",
      template: "custom",
      productIntent: {
        user: "admin user",
        problem: "security hardening",
        coreValue: "tamper-evident verdict"
      },
      qualityBars: {},
      createdAt: "2026-01-01T00:00:00Z"
    }),
    "utf8"
  );
}

test("work: taskId='.*' does NOT bypass task-existence check (regex injection fix)", async () => {
  await inTmp(async (dir) => {
    // TASKS.md contains only TASK-001 — NOT the regex-special taskId '.*'
    await seedMinimal(dir, "## TASK-001\n- do something\n");

    // Before fix: new RegExp(`\\b.*\\b`) would match any non-empty string,
    // so '.*' as taskId would falsely pass the task-existence check.
    // After fix: '.*' is escaped so it does NOT match, and WorkPrecondError is thrown.
    await assert.rejects(
      () => runWork({ taskId: ".*" }, buildDeps(dir)),
      WorkPrecondError,
      "taskId='.*' must throw WorkPrecondError (not bypass task-existence check)"
    );
  });
});

test("work: taskId with regex special chars (e.g. 'TASK.001') does not match 'TASKX001'", async () => {
  await inTmp(async (dir) => {
    // TASKS.md contains TASKX001 but NOT TASK.001 literally.
    // Without escaping, /\bTASK.001\b/ would match TASKX001 (. matches any char).
    await seedMinimal(dir, "## TASKX001\n- do something\n");

    await assert.rejects(
      () => runWork({ taskId: "TASK.001" }, buildDeps(dir)),
      WorkPrecondError,
      "taskId='TASK.001' must NOT match 'TASKX001' after regex escaping"
    );
  });
});

test("work: taskId='TASK.001' in worklog does NOT match 'TASKX001 — completed' (completedRe escaping)", async () => {
  await inTmp(async (dir) => {
    // TASKS.md has both ids so the task-existence check passes for either
    await seedMinimal(dir, "## TASK.001\n- something\n## TASKX001\n- other\n");

    // Pre-populate worklog with TASKX001 completed entry (no dot)
    // Without escaping, /^## TASK.001 .*completed\b/ would match "TASKX001 — completed"
    // because '.' matches any char. After the fix it must NOT match.
    await mkdir(join(dir, ".harness"), { recursive: true });
    await writeFile(
      join(dir, ".harness", "worklog.md"),
      "## TASKX001 — 2026-01-01T00:00:00Z\n- diff hash: abc\n- diff captured: false\n\n",
      "utf8"
    );

    // runWork for TASK.001 must NOT see TASKX001's entry as a duplicate.
    // It should proceed past the duplicate check (may fail later for other reasons).
    try {
      await runWork({ taskId: "TASK.001" }, buildDeps(dir));
    } catch (err) {
      if (err instanceof WorkDuplicateError) {
        assert.fail(
          `taskId='TASK.001' must NOT be treated as duplicate of 'TASKX001' — completedRe escaping broken`
        );
      }
      // Any other error (hooks, git, etc.) is acceptable — the point is no false duplicate
    }
  });
});

test("work: normal taskId 'TASK-001' still works when present in TASKS.md", async () => {
  await inTmp(async (dir) => {
    await seedMinimal(dir, "## TASK-001\n- do something\n");
    // runWork will fail later (no hooks.json) but must pass the taskId check.
    // We just confirm WorkPrecondError is NOT thrown for the taskId check —
    // it may throw for hooks.json missing which is fine.
    try {
      await runWork({ taskId: "TASK-001" }, buildDeps(dir));
    } catch (err) {
      // Must NOT be a "not found in TASKS.md" error
      if (err instanceof WorkPrecondError) {
        assert.ok(
          !/not found in TASKS\.md/.test(err.message),
          `taskId 'TASK-001' should be found in TASKS.md but got: ${err.message}`
        );
      }
      // Other errors (hooks, worklog duplicate, etc.) are acceptable
    }
  });
});
