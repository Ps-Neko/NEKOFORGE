import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSkillGuidance } from "../../../src/skill-packs/render.js";

test("renderSkillGuidance: promotedDefs 의 pack 도 렌더", () => {
  const out = renderSkillGuidance(["promo-x"], [{ id: "promo-x", appliesTo: "UI", guidance: ["use aria-label"] }]);
  assert.match(out, /promo-x/);
  assert.match(out, /aria-label/);
});

test("renderSkillGuidance: 내장 + promoted 혼합", () => {
  const out = renderSkillGuidance(
    ["typescript-quality", "promo-x"],
    [{ id: "promo-x", appliesTo: "UI", guidance: ["g"] }]
  );
  assert.match(out, /typescript-quality/);
  assert.match(out, /promo-x/);
});

test("renderSkillGuidance: 미해석 id 는 건너뜀", () => {
  assert.equal(renderSkillGuidance(["nonexistent"], []).trim(), "");
});
