import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import { submitCandidate, approveCandidate, readPromotedManifest } from "../../../src/core/promotion/store.js";
import type { CandidateDef, TrialRecord } from "../../../src/core/promotion/store-types.js";

async function freshArtifact() {
  const dir = await mkdtemp(join(tmpdir(), "promo-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  return { dir, artifact: new FsArtifact({ cwd: dir }) };
}

const cand: CandidateDef = {
  id: "c1", kind: "rule", modulePath: "./r.js", exportName: "r", submittedAt: "t0"
};
const readyTrial: TrialRecord = {
  baseline: { criticalRecall: 0.8, falsePositiveRate: 0.1, totalScenarios: 30 },
  candidate: { criticalRecall: 0.9, falsePositiveRate: 0.1, totalScenarios: 30 },
  verdict: "PROMOTE_READY", reasons: [], fixturesHash: "abc", ranAt: "t1"
};

test("submitCandidate: candidate.json 저장 + ledger 1줄", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  const saved = await artifact.readJson<CandidateDef>("promotions/c1/candidate.json");
  assert.equal(saved?.id, "c1");
  const led = await artifact.readMarkdown("promotions/ledger.jsonl");
  assert.match(led ?? "", /"action":"submit"/);
});

test("approveCandidate --approved: promoted.json 등록 + approvalHash + ledger", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  await artifact.writeJson("promotions/c1/trial.json", readyTrial);
  const res = await approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" });
  assert.equal(res.decision.verdict, "approved");
  assert.ok(res.decision.approvalHash);
  const man = await readPromotedManifest(artifact);
  assert.equal(man.rules.length, 1);
  assert.equal(man.rules[0]!.id, "c1");
});

test("approveCandidate: trial verdict 이 PROMOTE_READY 아니면 거부(throw)", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  await artifact.writeJson("promotions/c1/trial.json", { ...readyTrial, verdict: "REJECTED" });
  await assert.rejects(() => approveCandidate(artifact, "c1", { approvedBy: "me", clockNow: "t2" }));
});

test("submitCandidate: ledger-anchor.json 기록(lineCount>=1) §8-4", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  const anchor = await artifact.readJson<{ lineCount: number; lastHash: string | null }>("promotions/ledger-anchor.json");
  assert.ok(anchor, "anchor 파일이 있어야 함");
  assert.ok(anchor!.lineCount >= 1);
});

test("appendLedger: ledger 변조(라인 삭제) 시 다음 작업 차단 §8-4", async () => {
  const { artifact } = await freshArtifact();
  await submitCandidate(artifact, cand);
  // ledger 를 비워 lineCount 를 떨어뜨림(삭제 공격) — anchor 가 이를 탐지해야 함
  await artifact.writeMarkdown("promotions/ledger.jsonl", "");
  await assert.rejects(() => submitCandidate(artifact, { ...cand, id: "c2" }));
});
