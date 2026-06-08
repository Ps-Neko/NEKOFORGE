import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import {
  loadCandidateRule,
  computeFixturesHash,
  validateMinFixtures,
  verifyFixturesHash
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

const ROOT = resolve("proj-root-fixture");

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

// RCE 봉쇄: promoted.json 의 modulePath 가 프로젝트 루트 밖을 가리키면
// dynamic import 자체를 막는다(.harness 쓰기 권한자가 임의 파일 실행하는 gate-time RCE 차단).
test("loadCandidateRule: project root 밖 modulePath 는 import 없이 거부", async () => {
  let called = false;
  const importer = async (): Promise<Record<string, unknown>> => {
    called = true;
    return { myRule: goodRule };
  };
  const evil: CandidateDef = {
    id: "evil",
    kind: "rule",
    modulePath: resolve(ROOT, "..", "evil.js"),
    exportName: "myRule",
    submittedAt: "2026-06-08T00:00:00Z"
  };
  await assert.rejects(
    () => loadCandidateRule(evil, importer, ROOT),
    /escapes the project root|루트/
  );
  assert.equal(called, false, "루트 밖 모듈은 import 가 호출되면 안 된다");
});

test("loadCandidateRule: project root 안 modulePath 는 정상 로드", async () => {
  const good: CandidateDef = {
    id: "g",
    kind: "rule",
    modulePath: join(ROOT, "src", "rules", "x.js"),
    exportName: "myRule",
    submittedAt: "2026-06-08T00:00:00Z"
  };
  const r = await loadCandidateRule(
    good,
    async () => ({ myRule: goodRule }),
    ROOT
  );
  assert.equal(r.id, "my-rule");
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

test("verifyFixturesHash: 봉인 시점과 동일 fixtures → ok", () => {
  const files = { "g/s/expected.json": "{}", "g/s/last-diff.patch": "diff" };
  const expected = computeFixturesHash(cand, files);
  const r = verifyFixturesHash(expected, cand, files);
  assert.equal(r.ok, true);
  assert.equal(r.actual, expected);
});

test("verifyFixturesHash: fixtures 가 바뀌면 ok=false + 사유(§8-2)", () => {
  const expected = computeFixturesHash(cand, { "g/s/expected.json": "{}" });
  const r = verifyFixturesHash(expected, cand, { "g/s/expected.json": '{"x":1}' });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /fixtures|8-2|changed|바뀜/);
});
