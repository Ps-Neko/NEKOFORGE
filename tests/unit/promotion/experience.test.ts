import { test } from "node:test";
import assert from "node:assert/strict";
import { validateExperiences } from "../../../src/core/promotion/experience.js";

// 주입형 reader: 맵에 있으면 { kind } 반환, 없으면 null.
function reader(map: Record<string, string>) {
  return async (id: string) => (id in map ? { kind: map[id]! } : null);
}

test("validateExperiences: 실재 + 룰 관련 kind → ok", async () => {
  const r = await validateExperiences(["e1"], reader({ e1: "missed_risk" }));
  assert.equal(r.ok, true);
});

test("validateExperiences: 없는 eval-case → ok=false + 사유", async () => {
  const r = await validateExperiences(["nope"], reader({}));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /nope|없음/);
});

test("validateExperiences: 룰 무관 kind(milestone_passed) → ok=false", async () => {
  const r = await validateExperiences(["e1"], reader({ e1: "milestone_passed" }));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /룰 관련|milestone_passed/);
});

test("validateExperiences: 다중 중 하나라도 실패 → ok=false", async () => {
  const r = await validateExperiences(["e1", "bad"], reader({ e1: "false_negative" }));
  assert.equal(r.ok, false);
});

test("validateExperiences: 5종 룰 관련 kind 모두 허용", async () => {
  for (const k of ["false_positive", "false_negative", "missed_risk", "noisy_rule", "useful_rule"]) {
    const r = await validateExperiences(["e"], reader({ e: k }));
    assert.equal(r.ok, true, `kind ${k} 는 허용돼야 함`);
  }
});
