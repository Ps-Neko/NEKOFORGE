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

// Fix #2 regression guard — a corrupt/missing promoted module must NOT crash the gate.
// Graceful degradation: the bad entry is skipped with a warning, others still load.
test("loadPromotedRules: corrupt module (importer throws) → skipped, still returns valid rules", async () => {
  const ruleB: DeterministicRule = { id: "promoted-b", describe: "y", run: async () => [] };
  const twoEntryManifest: PromotedManifest = {
    rules: [
      { id: "promoted-a", modulePath: "./a.js", exportName: "ruleA", promotedAt: "2026-01-01T00:00:00Z", approvalHash: "aaa" },
      { id: "promoted-corrupt", modulePath: "./corrupt.js", exportName: "badExport", promotedAt: "2026-01-02T00:00:00Z", approvalHash: "bbb" },
      { id: "promoted-b", modulePath: "./b.js", exportName: "ruleB", promotedAt: "2026-01-03T00:00:00Z", approvalHash: "ccc" }
    ]
  };
  const brokenImporter = async (p: string) => {
    if (p === "./corrupt.js") throw new Error("module not found");
    if (p === "./a.js") return { ruleA };
    if (p === "./b.js") return { ruleB };
    return {};
  };

  const rules = await loadPromotedRules(async () => twoEntryManifest, brokenImporter);
  // Should return 2 valid rules, skipping the corrupt one
  assert.equal(rules.length, 2);
  assert.ok(rules.some((r) => r.id === "promoted-a"), "promoted-a should be present");
  assert.ok(rules.some((r) => r.id === "promoted-b"), "promoted-b should be present");
  assert.ok(!rules.some((r) => r.id === "promoted-corrupt"), "corrupt entry should be skipped");
});

test("loadPromotedRules: all modules corrupt → returns empty array (no crash)", async () => {
  const badManifest: PromotedManifest = {
    rules: [
      { id: "bad-1", modulePath: "./bad1.js", exportName: "r", promotedAt: "2026-01-01T00:00:00Z", approvalHash: "xxx" }
    ]
  };
  const alwaysThrows = async () => { throw new Error("disk error"); };

  const rules = await loadPromotedRules(async () => badManifest, alwaysThrows);
  assert.deepEqual(rules, []);
});
