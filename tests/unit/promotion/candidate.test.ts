import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCandidateRule,
  computeFixturesHash,
  validateMinFixtures
} from "../../../src/core/promotion/candidate.js";
import type { CandidateDef } from "../../../src/core/promotion/store-types.js";
import type { DeterministicRule } from "../../../src/rules/types.js";

const cand: CandidateDef = {
  id: "c1", kind: "rule", modulePath: "./fake.js",
  exportName: "myRule", submittedAt: "2026-05-27T00:00:00Z"
};
const goodRule: DeterministicRule = {
  id: "my-rule", describe: "x", run: async () => []
};

test("loadCandidateRule: importer 가 준 export 를 DeterministicRule 로 반환", async () => {
  const r = await loadCandidateRule(cand, async () => ({ myRule: goodRule }));
  assert.equal(r.id, "my-rule");
});

test("loadCandidateRule: export 가 rule 형이 아니면 throw", async () => {
  await assert.rejects(
    () => loadCandidateRule(cand, async () => ({ myRule: { nope: 1 } })),
    /not a DeterministicRule/
  );
});

test("computeFixturesHash: 동일 입력 동일 해시, 다른 fixture 다른 해시", () => {
  const a = computeFixturesHash(cand, { "f1/expected.json": "{}" });
  const b = computeFixturesHash(cand, { "f1/expected.json": "{}" });
  const c = computeFixturesHash(cand, { "f1/expected.json": '{"x":1}' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("validateMinFixtures: positive≥3 & negative≥2 → ok", () => {
  const r = validateMinFixtures(["BLOCK", "BLOCK", "NEEDS_HUMAN_REVIEW", "PASS", "PASS"]);
  assert.equal(r.ok, true);
});

test("validateMinFixtures: 부족하면 ok=false + 사유", () => {
  const r = validateMinFixtures(["BLOCK", "PASS"]);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /positive|negative/);
});
