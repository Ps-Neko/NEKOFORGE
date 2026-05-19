/**
 * Rule pack catalog + resolve tests (Phase RP).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RULE_PACK_CATALOG,
  findRulePack
} from "../../../src/rule-packs/catalog.js";
import {
  resolveRulePacks,
  isRuleEnabled
} from "../../../src/rule-packs/resolve.js";

test("catalog: 8 packs defined", () => {
  assert.equal(RULE_PACK_CATALOG.length, 8);
});

test("catalog: each pack has at least 1 rule + describe", () => {
  for (const p of RULE_PACK_CATALOG) {
    assert.ok(p.rules.length >= 1, `${p.id} should have rules`);
    assert.ok(p.describe.length > 0, `${p.id} should have describe`);
  }
});

test("findRulePack: known + unknown", () => {
  assert.ok(findRulePack("security-core"));
  assert.equal(findRulePack("does-not-exist"), undefined);
});

test("resolveRulePacks: web-ui template lists design-web required", () => {
  const r = resolveRulePacks({
    packs: {
      schemaVersion: "0.5",
      enabledPacks: ["security-core"],
      requiredForTemplates: {
        "web-ui": ["security-core", "design-web"]
      }
    },
    template: "web-ui"
  });
  assert.deepEqual(r.required, ["security-core", "design-web"]);
  assert.deepEqual(r.missingRequired, ["design-web"]);
});

test("resolveRulePacks: release mode forces release-strict", () => {
  const r = resolveRulePacks({
    packs: {
      schemaVersion: "0.5",
      enabledPacks: []
    },
    mode: "release"
  });
  assert.ok(r.missingRequired.includes("release-strict"));
});

test("isRuleEnabled: rule inside enabled pack → true", () => {
  assert.equal(isRuleEnabled("secret-fallback", ["security-core"]), true);
});

test("isRuleEnabled: rule not in any pack (audit-integrity) → true", () => {
  assert.equal(isRuleEnabled("audit-integrity", []), true);
});

test("isRuleEnabled: rule in disabled pack → false", () => {
  assert.equal(isRuleEnabled("accessibility-risk", ["security-core"]), false);
});
