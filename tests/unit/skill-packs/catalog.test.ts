/**
 * Skill pack catalog + resolve tests (Phase RP).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SKILL_PACK_CATALOG,
  findSkillPack
} from "../../../src/skill-packs/catalog.js";
import { resolveSkillPacks } from "../../../src/skill-packs/index.js";
import { renderSkillGuidance } from "../../../src/skill-packs/render.js";

test("catalog: 7 packs defined", () => {
  assert.equal(SKILL_PACK_CATALOG.length, 7);
});

test("findSkillPack: known + unknown", () => {
  assert.ok(findSkillPack("typescript-quality"));
  assert.equal(findSkillPack("nope"), undefined);
});

test("resolveSkillPacks: backend-api recommendation", () => {
  const r = resolveSkillPacks(
    {
      schemaVersion: "0.5",
      enabledPacks: ["typescript-quality"],
      recommendedForTemplates: {
        "backend-api": [
          "typescript-quality",
          "backend-api-quality",
          "evidence-writing"
        ]
      }
    },
    "backend-api"
  );
  assert.deepEqual(r.missingRecommended, [
    "backend-api-quality",
    "evidence-writing"
  ]);
});

test("renderSkillGuidance: emits headings + bullets", () => {
  const md = renderSkillGuidance(["typescript-quality"]);
  assert.match(md, /typescript-quality/);
  assert.match(md, /strict typing/);
});
