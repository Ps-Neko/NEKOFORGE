import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../../src/core/stage-runner.js";
import { runWorkersInit } from "../../../src/workers/index.js";
import { ensureSkillPacks } from "../../../src/skill-packs/index.js";
import { runDispatch } from "../../../src/workers/dispatch.js";

async function freshDeps() {
  const dir = await mkdtemp(join(tmpdir(), "disp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return buildDeps(dir);
}

test("runDispatch: enabled skill-pack guidance 가 프롬프트에 주입", async () => {
  const deps = await freshDeps();
  await runWorkersInit({ profile: "standard", force: true }, deps);
  await ensureSkillPacks(deps); // default enabled: typescript-quality, evidence-writing
  const r = await runDispatch({ taskId: "t1", worker: "implementation-worker" }, deps);
  assert.match(r.promptBody, /스킬팩 지침/);
  assert.match(r.promptBody, /typescript-quality/);
});

test("runDispatch: skill-packs.json 없으면 guidance 블록 생략", async () => {
  const deps = await freshDeps();
  await runWorkersInit({ profile: "standard", force: true }, deps);
  const r = await runDispatch({ taskId: "t2", worker: "implementation-worker" }, deps);
  assert.equal(/스킬팩 지침/.test(r.promptBody), false);
});
