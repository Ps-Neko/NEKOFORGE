import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAutoApplyBlock,
  AutoApplyBlockedError,
  autoApplyBlockRule
} from "../../../src/rules/auto-apply-block.js";
import { mockCtx } from "./_helpers.js";

test("auto-apply-block: BLOCK throws AutoApplyBlockedError with exit 4", () => {
  try {
    evaluateAutoApplyBlock({ verdict: "BLOCK" });
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof AutoApplyBlockedError);
    assert.equal((err as AutoApplyBlockedError).exitCode, 4);
  }
});

test("auto-apply-block: INSUFFICIENT_EVIDENCE throws", () => {
  assert.throws(
    () => evaluateAutoApplyBlock({ verdict: "INSUFFICIENT_EVIDENCE" }),
    AutoApplyBlockedError
  );
});

test("auto-apply-block: PASS does not throw", () => {
  assert.doesNotThrow(() => evaluateAutoApplyBlock({ verdict: "PASS" }));
});

test("auto-apply-block: PASS_WITH_WARNINGS does not throw", () => {
  assert.doesNotThrow(() =>
    evaluateAutoApplyBlock({ verdict: "PASS_WITH_WARNINGS" })
  );
});

test("auto-apply-block: NEEDS_HUMAN_REVIEW does not throw (handled by Human Gate)", () => {
  assert.doesNotThrow(() =>
    evaluateAutoApplyBlock({ verdict: "NEEDS_HUMAN_REVIEW" })
  );
});

test("auto-apply-block rule: returns informational finding only", async () => {
  const ctx = mockCtx();
  const out = await autoApplyBlockRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "info");
});
