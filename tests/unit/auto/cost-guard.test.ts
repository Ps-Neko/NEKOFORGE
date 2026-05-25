import { test } from "node:test";
import assert from "node:assert/strict";
import { createCostGuard, CostExceededError } from "../../../src/core/auto/cost-guard.js";

test("cost-guard: 예산 내 호출은 통과하고 누적된다", () => {
  const g = createCostGuard(1.0);
  g.assertCanSpend(0.4);
  g.record(0.4);
  g.assertCanSpend(0.5);
  g.record(0.5);
  assert.equal(g.spent(), 0.9);
});

test("cost-guard: 예산 초과 예상이면 호출 전 throw (exitCode 5)", () => {
  const g = createCostGuard(0.5);
  g.record(0.4);
  assert.throws(() => g.assertCanSpend(0.2), (e: unknown) => {
    assert.ok(e instanceof CostExceededError);
    assert.equal((e as CostExceededError).exitCode, 5);
    assert.match((e as Error).message, /0\.5/);
    return true;
  });
});

test("cost-guard: maxUsd=0 이면 첫 호출 전 즉시 차단", () => {
  const g = createCostGuard(0);
  assert.throws(() => g.assertCanSpend(0.01), CostExceededError);
});
