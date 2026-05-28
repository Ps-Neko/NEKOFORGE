import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../src/core/stage-runner.js";
import { runInit } from "../../src/core/init.js";
import { runPacket } from "../../src/core/packet/index.js";

test("packet stage builds an AI work packet from context and task evidence", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-packet-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await runInit({ cwd });
  const deps = buildDeps(cwd);
  await deps.artifact.writeMarkdown(
    "intake.md",
    ["# Intake", "", "- goal: |", "  Add login lockout after failed attempts", ""].join("\n")
  );
  await deps.artifact.writeMarkdown(
    "context.md",
    [
      "# Context",
      "",
      "### Suggested Relevant Files",
      "- src/auth/login.ts",
      "- tests/auth/login.test.ts",
      "",
      "### Package Scripts",
      "- test: node --test",
      "",
      "### Tests",
      "- tests/auth/login.test.ts",
      "",
      "### Risk-sensitive Files",
      "- src/auth/login.ts",
      ""
    ].join("\n")
  );
  await deps.artifact.writeMarkdown("SPEC.md", "# SPEC\n\nUser wants safer login.\n");
  await deps.artifact.writeMarkdown("PLAN.md", "# PLAN\n\nImplement lockout in one task.\n");
  await deps.artifact.writeMarkdown(
    "TASKS.md",
    [
      "# TASKS",
      "",
      "| id | title | depends | acceptance | tests | rollback | expectedFiles | doneCriteria |",
      "|---|---|---|---|---|---|---|---|",
      "| TASK-001 | login lockout | - | locks after five failures | auth test | revert | src/auth/login.ts | tests pass |",
      ""
    ].join("\n")
  );

  const result = await runPacket(
    {
      taskId: "TASK-001",
      workerPrompts: [{ role: "implementation-worker", path: ".harness/worker-runs/TASK-001/implementation-worker.prompt.md" }]
    },
    deps
  );

  const packet = await readFile(join(cwd, result.packetPath), "utf8");
  assert.deepEqual(result.packetPaths, [".harness/task-packets/TASK-001.md"]);
  assert.match(packet, /AI Work Packet - TASK-001/);
  assert.match(packet, /Add login lockout after failed attempts/);
  assert.match(packet, /src\/auth\/login\.ts/);
  assert.match(packet, /test: node --test/);
  assert.match(packet, /implementation-worker/);
  assert.match(packet, /harness gate --task TASK-001/);
});

test("packet stage can render tool-specific packets for Codex, Claude, and Cursor", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-packet-tools-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await runInit({ cwd });
  const deps = buildDeps(cwd);
  await deps.artifact.writeMarkdown(
    "intake.md",
    ["# Intake", "", "- goal: |", "  Update billing invoice totals", ""].join("\n")
  );
  await deps.artifact.writeMarkdown(
    "context.md",
    [
      "# Context",
      "",
      "### Suggested Relevant Files",
      "- src/billing/invoice.ts",
      "",
      "### Package Scripts",
      "- test: node --test",
      ""
    ].join("\n")
  );

  const result = await runPacket({ taskId: "TASK-002", tool: "all" }, deps);

  assert.deepEqual(result.packetPaths, [
    ".harness/task-packets/TASK-002.md",
    ".harness/task-packets/TASK-002.codex.md",
    ".harness/task-packets/TASK-002.claude.md",
    ".harness/task-packets/TASK-002.cursor.md"
  ]);
  const codex = await readFile(join(cwd, ".harness/task-packets/TASK-002.codex.md"), "utf8");
  const claude = await readFile(join(cwd, ".harness/task-packets/TASK-002.claude.md"), "utf8");
  const cursor = await readFile(join(cwd, ".harness/task-packets/TASK-002.cursor.md"), "utf8");
  assert.match(codex, /Codex Work Packet/);
  assert.match(claude, /Claude Code Work Packet/);
  assert.match(cursor, /Cursor Work Packet/);
  assert.match(codex, /Paste This To The AI Tool/);
  assert.match(claude, /Do not commit, push, deploy/);
  assert.match(cursor, /src\/billing\/invoice\.ts/);
});
