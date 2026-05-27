import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSkillPackCandidate } from "../../../src/core/promotion/skill-pack.js";

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
