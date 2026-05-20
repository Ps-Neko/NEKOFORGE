/**
 * harness doctor unit test (Phase UX).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor, renderDoctorMd } from "../../../src/core/doctor/index.js";
import { buildDeps } from "../../../src/core/stage-runner.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "nf-doctor-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("doctor: empty dir reports warns (no .harness, no package.json)", async () => {
  await inTmp(async (dir) => {
    const r = await runDoctor(buildDeps(dir));
    assert.ok(r.checks.some((c) => c.id === "harness-dir" && c.status === "warn"));
    assert.ok(r.checks.some((c) => c.id === "package-json" && c.status === "warn"));
    assert.ok(r.summary.warn > 0);
  });
});

test("doctor: with .harness/ directory passes harness-dir check", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    const r = await runDoctor(buildDeps(dir));
    assert.ok(r.checks.some((c) => c.id === "harness-dir" && c.status === "ok"));
  });
});

test("doctor: detects workers.json + rule-packs.json + skill-packs.json", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    for (const f of ["workers.json", "rule-packs.json", "skill-packs.json", "quality-contract.json"]) {
      await writeFile(join(dir, ".harness", f), "{}", "utf8");
    }
    const r = await runDoctor(buildDeps(dir));
    for (const id of ["workers.json", "rule-packs.json", "skill-packs.json", "quality-contract.json"]) {
      assert.ok(r.checks.some((c) => c.id === id && c.status === "ok"), `${id} should be ok`);
    }
  });
});

test("doctor: renderDoctorMd produces markdown with summary line", async () => {
  await inTmp(async (dir) => {
    const r = await runDoctor(buildDeps(dir));
    const md = renderDoctorMd(r);
    assert.match(md, /# harness doctor/);
    assert.match(md, /summary: ok=/);
  });
});

test("doctor: node version >= 20 OK", async () => {
  await inTmp(async (dir) => {
    const r = await runDoctor(buildDeps(dir));
    const c = r.checks.find((x) => x.id === "node-version");
    assert.ok(c);
    assert.equal(c?.status, "ok");
  });
});
