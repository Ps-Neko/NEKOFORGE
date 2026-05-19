/**
 * Phase D 후속 — generic export adapter 단위 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportGeneric,
  GenericExportPrecondError,
  GENERIC_ALLOWED_INPUTS
} from "../../../src/integrations/generic/export.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-generic-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("generic export: ALLOWED_INPUTS list is non-empty and excludes .export", () => {
  assert.ok(GENERIC_ALLOWED_INPUTS.length > 0);
  for (const n of GENERIC_ALLOWED_INPUTS) {
    assert.ok(!n.includes(".export"));
  }
});

test("generic export: precond fails if .harness/ missing", async () => {
  await inTmp(async (dir) => {
    await assert.rejects(
      () => exportGeneric({ cwd: dir }),
      GenericExportPrecondError
    );
  });
});

test("generic export: copies present files and manifest tracks which were copied", async () => {
  await inTmp(async (dir) => {
    const harnessRoot = join(dir, ".harness");
    await mkdir(harnessRoot, { recursive: true });
    await writeFile(
      join(harnessRoot, "team.json"),
      JSON.stringify({ schemaVersion: "0.3", pattern: "Pipeline", agents: [] }),
      "utf8"
    );
    await writeFile(
      join(harnessRoot, "quality-policy.md"),
      "# qp\n",
      "utf8"
    );
    const r = await exportGeneric({ cwd: dir });
    assert.ok(r.files.length >= 2);
    await stat(join(dir, ".export", "manifest.json"));
    const manifest = JSON.parse(
      await readFile(join(dir, ".export", "manifest.json"), "utf8")
    ) as { copied: Record<string, boolean> };
    assert.equal(manifest.copied["team.json"], true);
    assert.equal(manifest.copied["quality-policy.md"], true);
    assert.equal(manifest.copied["rules.json"], false);
  });
});
