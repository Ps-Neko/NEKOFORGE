import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../src/artifact/fs-artifact.js";
import { submitCandidate, approveCandidate, readPromotedManifest } from "../../src/core/promotion/store.js";
import { loadActiveRules } from "../../src/core/promotion/promoted.js";
import { DEFAULT_BENCHMARK_RULES } from "../../src/benchmark/index.js";
import type { CandidateDef, TrialRecord } from "../../src/core/promotion/store-types.js";

test("self-host: todo-comment-risk 를 게이트로 채용 → loadActiveRules 에 합류", async () => {
  const dir = await mkdtemp(join(tmpdir(), "selfhost-"));
  await mkdir(join(dir, ".harness"), { recursive: true });
  const artifact = new FsArtifact({ cwd: dir });

  const cand: CandidateDef = {
    id: "todo-rule", kind: "rule",
    // 빌드/실행 환경에서 import 가능한 절대 경로(소스 모듈).
    modulePath: join(process.cwd(), "src/rules/promotion-candidates/todo-comment-risk.ts"),
    exportName: "todoCommentRiskRule", submittedAt: "t0"
  };
  await submitCandidate(artifact, cand);
  const trial: TrialRecord = {
    baseline: { criticalRecall: 0.8, falsePositiveRate: 0.1, totalScenarios: 30 },
    candidate: { criticalRecall: 0.9, falsePositiveRate: 0.1, totalScenarios: 30 },
    verdict: "PROMOTE_READY", reasons: [], fixturesHash: "x", ranAt: "t1"
  };
  await artifact.writeJson("promotions/todo-rule/trial.json", trial);
  await approveCandidate(artifact, "todo-rule", { approvedBy: "me", clockNow: "t2" });

  const active = await loadActiveRules(() => readPromotedManifest(artifact));
  assert.ok(active.some((r) => r.id === "todo-comment-risk"));
  assert.equal(active.length, DEFAULT_BENCHMARK_RULES.length + 1);
});
