/**
 * Phase D — cursor export 단위 테스트.
 * - 결정적: 동일 입력 → 동일 출력 해시.
 * - 화이트리스트 외 입력 거부.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportCursor,
  readCursorInputFile,
  CursorExportPathViolationError,
  CursorExportPrecondError,
  CURSOR_ALLOWED_INPUTS
} from "../../../src/integrations/cursor/export.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-cursor-"));
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
        { id: "impl-1", role: "implementation-agent", owns: ["TASK-001"] },
        { id: "sec-1", role: "security-reviewer", owns: ["TASK-001"] }
      ]
    }),
    "utf8"
  );
  await writeFile(
    join(harnessRoot, "skills-map.json"),
    JSON.stringify({ schemaVersion: "0.3", mappings: [] }),
    "utf8"
  );
  await writeFile(
    join(harnessRoot, "quality-policy.md"),
    "# Quality Policy\n\nminimal\n",
    "utf8"
  );
  await writeFile(
    join(harnessRoot, "rules.json"),
    JSON.stringify({
      schemaVersion: "0.3",
      applied: [
        {
          id: "ts-strict",
          title: "TS strict",
          severity: "high",
          scope: ["src/**/*.ts"]
        }
      ]
    }),
    "utf8"
  );
}

async function hashDir(dir: string): Promise<string> {
  const files = (await readdir(dir, { recursive: true } as unknown as undefined))
    .filter((f) => typeof f === "string")
    .sort();
  const h = createHash("sha256");
  for (const f of files as unknown as string[]) {
    const p = join(dir, f);
    try {
      const text = await readFile(p, "utf8");
      h.update(f).update("\0").update(text).update("\0");
    } catch {
      // directory — skip
    }
  }
  return h.digest("hex");
}

test("cursor export: rejects unknown input via readCursorInputFile", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => readCursorInputFile(join(dir, ".harness"), "decision.json"),
      CursorExportPathViolationError
    );
    await assert.rejects(
      () => readCursorInputFile(join(dir, ".harness"), "../etc/passwd"),
      CursorExportPathViolationError
    );
  });
});

test("cursor export: ALLOWED_INPUTS excludes .cursor/ paths", () => {
  for (const name of CURSOR_ALLOWED_INPUTS) {
    assert.ok(!name.includes(".cursor"));
    assert.ok(!name.startsWith("/"));
  }
});

test("cursor export: missing team.json → CursorExportPrecondError", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await assert.rejects(
      () => exportCursor({ cwd: dir }),
      CursorExportPrecondError
    );
  });
});

test("cursor export: writes deterministic .cursor/rules + .cursor/context", async () => {
  await inTmp(async (dir) => {
    await seedMinimal(dir);
    const r1 = await exportCursor({ cwd: dir });
    assert.ok(r1.ruleFiles.length >= 2);
    assert.equal(r1.contextFiles.length, 2);

    const hash1 = await hashDir(join(dir, ".cursor"));
    // 다시 export — 동일 해시여야 함 (결정적)
    await exportCursor({ cwd: dir });
    const hash2 = await hashDir(join(dir, ".cursor"));
    assert.equal(hash1, hash2, "cursor export is not deterministic");
  });
});
