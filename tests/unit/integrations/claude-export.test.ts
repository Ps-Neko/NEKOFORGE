/**
 * T-SEC-15, T-SEC-16 — claude export adapter.
 *
 * - T-SEC-15: 화이트리스트 외 경로 접근 시도 → ExportPathViolationError.
 * - T-SEC-16: 역방향 import 금지 (ALLOWED_INPUTS 가 `.claude/` 시작 경로 미포함).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALLOWED_INPUTS,
  ExportPathViolationError,
  readInputFile,
  exportClaude
} from "../../../src/integrations/claude/export.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-export-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("T-SEC-15: readInputFile rejects path outside whitelist", async () => {
  await inTmp(async (dir) => {
    const harnessRoot = join(dir, ".harness");
    await mkdir(harnessRoot, { recursive: true });
    await assert.rejects(
      () => readInputFile(harnessRoot, "../etc/passwd"),
      ExportPathViolationError
    );
    await assert.rejects(
      () => readInputFile(harnessRoot, ".env"),
      ExportPathViolationError
    );
    await assert.rejects(
      () => readInputFile(harnessRoot, "decision.json"),
      ExportPathViolationError
    );
  });
});

test("T-SEC-16a: ALLOWED_INPUTS excludes any .claude/ paths", () => {
  for (const name of ALLOWED_INPUTS) {
    assert.ok(!name.startsWith("."), `whitelist contains hidden path: ${name}`);
    assert.ok(
      !name.includes(".claude"),
      `whitelist must not reach into .claude/: ${name}`
    );
    assert.ok(
      !name.startsWith("/"),
      `whitelist must not be absolute: ${name}`
    );
  }
});

test("T-SEC-16b: exportClaude ignores existing .claude/ inputs (no reverse import)", async () => {
  await inTmp(async (dir) => {
    const harnessRoot = join(dir, ".harness");
    await mkdir(harnessRoot, { recursive: true });
    await writeFile(
      join(harnessRoot, "team.json"),
      JSON.stringify({
        schemaVersion: "0.3",
        pattern: "Pipeline",
        agents: [
          { id: "impl-1", role: "implementation-agent", owns: ["TASK-001"] }
        ]
      }),
      "utf8"
    );
    await writeFile(
      join(harnessRoot, "skills-map.json"),
      JSON.stringify({ schemaVersion: "0.3", mappings: [] }),
      "utf8"
    );

    // Plant a malicious .claude/ file that the adapter must NOT read.
    const claudeRoot = join(dir, ".claude", "agents");
    await mkdir(claudeRoot, { recursive: true });
    const planted = join(claudeRoot, "impl-1.md");
    await writeFile(planted, "MALICIOUS_FROM_CLAUDE", "utf8");

    const result = await exportClaude({ cwd: dir });
    assert.equal(result.agents.length, 1);

    const { readFile } = await import("node:fs/promises");
    const rewritten = await readFile(planted, "utf8");
    assert.ok(
      !rewritten.includes("MALICIOUS_FROM_CLAUDE"),
      "exportClaude must overwrite, not extend, .claude/ files"
    );
    assert.ok(rewritten.includes("Generated from .harness/team.json"));
  });
});
