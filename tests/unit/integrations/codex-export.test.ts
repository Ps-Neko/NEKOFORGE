/**
 * Phase D 후속 — codex export adapter 단위 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportCodex,
  readCodexInputFile,
  CodexExportPathViolationError,
  CodexExportPrecondError,
  CODEX_ALLOWED_INPUTS
} from "../../../src/integrations/codex/export.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-codex-export-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function seedMinimal(dir: string): Promise<void> {
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
    join(harnessRoot, "quality-policy.md"),
    "# Quality Policy\nminimal\n",
    "utf8"
  );
}

async function hashDir(dir: string): Promise<string> {
  const files = (await readdir(dir, { recursive: true } as never)) as unknown as string[];
  const h = createHash("sha256");
  for (const f of files.sort()) {
    const p = join(dir, f);
    try {
      const text = await readFile(p, "utf8");
      h.update(f).update("\0").update(text).update("\0");
    } catch {
      // skip directories
    }
  }
  return h.digest("hex");
}

test("codex export: ALLOWED_INPUTS excludes .codex/ paths", () => {
  for (const name of CODEX_ALLOWED_INPUTS) {
    assert.ok(!name.includes(".codex"));
    assert.ok(!name.startsWith("/"));
  }
});

test("codex export: rejects unknown input", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => readCodexInputFile(join(dir, ".harness"), "decision.json"),
      CodexExportPathViolationError
    );
  });
});

test("codex export: missing team.json → CodexExportPrecondError", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => exportCodex({ cwd: dir }),
      CodexExportPrecondError
    );
  });
});

test("codex export: deterministic .codex/agents and policy", async () => {
  await inTmp(async (dir) => {
    await seedMinimal(dir);
    const r1 = await exportCodex({ cwd: dir });
    assert.equal(r1.agents.length, 1);
    const hash1 = await hashDir(join(dir, ".codex"));
    await exportCodex({ cwd: dir });
    const hash2 = await hashDir(join(dir, ".codex"));
    assert.equal(hash1, hash2, "codex export not deterministic");
  });
});
