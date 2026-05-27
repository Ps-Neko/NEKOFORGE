import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSkillPackCandidate,
  submitSkillPack, approveSkillPack, rejectSkillPack, type SkillPackCandidate
} from "../../../src/core/promotion/skill-pack.js";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import { readPromotedSkillPacks } from "../../../src/skill-packs/promoted.js";

const builtin = new Set(["typescript-quality"]);

test("validate: 정상 → ok", () => {
  assert.equal(validateSkillPackCandidate({ id: "x", appliesTo: "Y", guidance: ["g1"] }, builtin).ok, true);
});

test("validate: id 누락 → not ok", () => {
  assert.equal(validateSkillPackCandidate({ appliesTo: "Y", guidance: ["g"] }, builtin).ok, false);
});

test("validate: 빈 guidance → not ok", () => {
  assert.equal(validateSkillPackCandidate({ id: "x", appliesTo: "Y", guidance: [] }, builtin).ok, false);
});

test("validate: builtin 충돌 → not ok + 사유", () => {
  const r = validateSkillPackCandidate({ id: "typescript-quality", appliesTo: "Y", guidance: ["g"] }, builtin);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /충돌|builtin/);
});

async function freshA() {
  const dir = await mkdtemp(join(tmpdir(), "spp-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return new FsArtifact({ cwd: dir });
}
const spCand: SkillPackCandidate = { id: "sp1", appliesTo: "X", guidance: ["g1"], submittedAt: "t0" };

test("submitSkillPack: skill-pack.json + ledger", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  const saved = await a.readJson<SkillPackCandidate>("promotions/sp1/skill-pack.json");
  assert.equal(saved?.id, "sp1");
  const led = await a.readMarkdown("promotions/ledger.jsonl");
  assert.match(led ?? "", /"action":"submit"/);
});

test("approveSkillPack: promoted-skill-packs.json 봉인 + approvalHash", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  const { entry } = await approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t1" });
  assert.ok(entry.approvalHash.length === 64);
  const m = await readPromotedSkillPacks(a);
  assert.equal(m.packs[0]!.id, "sp1");
});

test("approveSkillPack: 후보 없으면 throw", async () => {
  const a = await freshA();
  await assert.rejects(() => approveSkillPack(a, "nope", { approvedBy: "me", clockNow: "t1" }));
});

test("approveSkillPack: 이미 채용된 id 면 throw", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  await approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t1" });
  await submitSkillPack(a, { ...spCand, submittedAt: "t2" });
  await assert.rejects(() => approveSkillPack(a, "sp1", { approvedBy: "me", clockNow: "t3" }));
});

test("rejectSkillPack: decision rejected + ledger", async () => {
  const a = await freshA();
  await submitSkillPack(a, spCand);
  await rejectSkillPack(a, "sp1", "별로", "t1");
  const d = await a.readJson<{ verdict: string }>("promotions/sp1/decision.json");
  assert.equal(d?.verdict, "rejected");
});
