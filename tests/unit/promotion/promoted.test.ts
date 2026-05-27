import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPromotedRules, loadActiveRules } from "../../../src/core/promotion/promoted.js";
import { DEFAULT_BENCHMARK_RULES } from "../../../src/benchmark/index.js";
import type { PromotedManifest } from "../../../src/core/promotion/store-types.js";
import type { DeterministicRule } from "../../../src/rules/types.js";

const ruleA: DeterministicRule = { id: "promoted-a", describe: "x", run: async () => [] };

const manifest: PromotedManifest = {
  rules: [{
    id: "promoted-a", modulePath: "./a.js", exportName: "ruleA",
    promotedAt: "2026-05-27T00:00:00Z", approvalHash: "deadbeef"
  }]
};

test("loadPromotedRules: 매니페스트 없으면 빈 배열", async () => {
  const rules = await loadPromotedRules(async () => null, async () => ({}));
  assert.deepEqual(rules, []);
});

test("loadPromotedRules: 매니페스트의 각 항목을 import 해 rule 반환", async () => {
  const rules = await loadPromotedRules(
    async () => manifest,
    async () => ({ ruleA })
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0]!.id, "promoted-a");
});

test("loadActiveRules: DEFAULT + promoted 합집합", async () => {
  const active = await loadActiveRules(async () => manifest, async () => ({ ruleA }));
  assert.equal(active.length, DEFAULT_BENCHMARK_RULES.length + 1);
});
