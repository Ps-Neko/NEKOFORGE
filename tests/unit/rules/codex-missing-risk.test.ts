import { test } from "node:test";
import assert from "node:assert/strict";
import { codexMissingRiskRule } from "../../../src/rules/codex-missing-risk.js";
import { mockCtx, diffOf } from "./_helpers.js";

test("codex-missing-risk: high risk + 0 adapters triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    highRiskFlags: { dangerousFileWrite: true },
    review: { status: "not_run", adapterCount: 0, criticalFindings: 0 }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "critical");
});

test("codex-missing-risk: high risk + adapter but not_run triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    highRiskFlags: { authBypass: true },
    review: { status: "not_run", adapterCount: 1, criticalFindings: 0 }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "high");
});

test("codex-missing-risk: secretFallback flag is a high-risk trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    highRiskFlags: { secretFallback: true },
    review: { status: "not_run", adapterCount: 1, criticalFindings: 0 }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("codex-missing-risk: high risk + adapter passed is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    highRiskFlags: { dangerousFileWrite: true },
    review: { status: "passed", adapterCount: 1, criticalFindings: 0 }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("codex-missing-risk: low risk + 0 adapters is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    review: { status: "not_run", adapterCount: 0, criticalFindings: 0 }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("codex-missing-risk: no review snapshot + high risk treats as 0 adapters", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    highRiskFlags: { hookInjection: true }
  });
  const out = await codexMissingRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "critical");
});
