import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import {
  readPromotedSkillPacks, writePromotedSkillPacks, loadPromotedSkillPackIds
} from "../../../src/skill-packs/promoted.js";

async function fresh() {
  const dir = await mkdtemp(join(tmpdir(), "sp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return new FsArtifact({ cwd: dir });
}

test("readPromotedSkillPacks: 없으면 packs []", async () => {
  const a = await fresh();
  assert.deepEqual(await readPromotedSkillPacks(a), { packs: [] });
});

test("write→read roundtrip + loadPromotedSkillPackIds", async () => {
  const a = await fresh();
  await writePromotedSkillPacks(a, {
    packs: [{ id: "p1", appliesTo: "X", guidance: ["g"], promotedAt: "t", approvalHash: "h" }]
  });
  const m = await readPromotedSkillPacks(a);
  assert.equal(m.packs.length, 1);
  const ids = await loadPromotedSkillPackIds(a);
  assert.ok(ids.has("p1"));
});
