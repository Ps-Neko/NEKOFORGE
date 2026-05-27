import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../../src/core/stage-runner.js";
import { enableSkillPack, getSkillPackStatus } from "../../../src/skill-packs/index.js";

async function depsWithPromoted() {
  const dir = await mkdtemp(join(tmpdir(), "spv-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  const deps = buildDeps(dir);
  await deps.artifact.writeJson("promoted-skill-packs.json", {
    packs: [{ id: "promo-x", appliesTo: "X", guidance: ["g"], promotedAt: "t", approvalHash: "h" }]
  });
  return deps;
}

test("enableSkillPack: 채용된 promoted pack 도 enable 가능(unknown 아님)", async () => {
  const deps = await depsWithPromoted();
  const next = await enableSkillPack("promo-x", deps);
  assert.ok(next.enabledPacks.includes("promo-x"));
});

test("getSkillPackStatus: 채용된 pack 을 unknown 으로 오인 안 함", async () => {
  const deps = await depsWithPromoted();
  await enableSkillPack("promo-x", deps);
  const status = await getSkillPackStatus(deps);
  assert.equal(status.unknownEnabled.includes("promo-x"), false);
});
