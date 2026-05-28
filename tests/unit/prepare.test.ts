import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrepare } from "../../src/core/prepare/index.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("runPrepare creates intake + clarify + context + source-map + packet from a single goal", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-prepare-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const result = await runPrepare({ cwd, goal: "Add login lockout after failed attempts" });

  assert.ok(await exists(join(cwd, ".harness", "intake.md")));
  assert.ok(await exists(join(cwd, ".harness", "clarify.md")));
  assert.ok(await exists(join(cwd, ".harness", "context.md")));
  assert.ok(await exists(join(cwd, ".harness", "source-map.json")));
  assert.ok(await exists(join(cwd, ".harness", "source-map.md")));

  assert.equal(result.taskId, "TASK-001");
  assert.equal(result.packetPaths.length, 1);
  assert.equal(result.packetPaths[0], ".harness/task-packets/TASK-001.md");

  const packet = await readFile(join(cwd, result.packetPaths[0]!), "utf8");
  assert.match(packet, /AI Work Packet - TASK-001/);
  assert.match(packet, /Add login lockout after failed attempts/);
});

test("runPrepare auto-initializes .harness/ when absent", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-prepare-init-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  assert.equal(await exists(join(cwd, ".harness")), false);
  await runPrepare({ cwd, goal: "First run" });
  assert.ok(await exists(join(cwd, ".harness", "config.json")));
});

test("runPrepare respects --tool all and emits all tool-specific packets", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-prepare-tools-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const result = await runPrepare({
    cwd,
    goal: "Update billing invoice totals",
    tool: "all"
  });

  assert.deepEqual(result.packetPaths, [
    ".harness/task-packets/TASK-001.md",
    ".harness/task-packets/TASK-001.codex.md",
    ".harness/task-packets/TASK-001.claude.md",
    ".harness/task-packets/TASK-001.cursor.md"
  ]);

  const codex = await readFile(join(cwd, ".harness/task-packets/TASK-001.codex.md"), "utf8");
  assert.match(codex, /Codex Work Packet/);
});

test("runPrepare respects --task-id option", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-prepare-taskid-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const result = await runPrepare({ cwd, goal: "Custom task id", taskId: "FEAT-42" });
  assert.equal(result.taskId, "FEAT-42");
  assert.equal(result.packetPaths[0], ".harness/task-packets/FEAT-42.md");
  assert.ok(await exists(join(cwd, ".harness/task-packets/FEAT-42.md")));
});

test("runPrepare can run twice with different goals on the same workspace", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-prepare-rerun-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await runPrepare({ cwd, goal: "First goal", taskId: "TASK-001" });
  await runPrepare({ cwd, goal: "Second goal", taskId: "TASK-002" });

  assert.ok(await exists(join(cwd, ".harness/task-packets/TASK-001.md")));
  assert.ok(await exists(join(cwd, ".harness/task-packets/TASK-002.md")));

  const second = await readFile(join(cwd, ".harness/task-packets/TASK-002.md"), "utf8");
  assert.match(second, /Second goal/);
});
