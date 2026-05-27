import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGateTestStatus } from "../../../src/cli/commands/gate.js";

test("parseGateTestStatus: valid values pass through", () => {
  assert.equal(parseGateTestStatus("passed"), "passed");
  assert.equal(parseGateTestStatus("failed"), "failed");
  assert.equal(parseGateTestStatus("not_run"), "not_run");
  assert.equal(parseGateTestStatus("insufficient"), "insufficient");
});

test("parseGateTestStatus: undefined stays undefined for hook inference", () => {
  assert.equal(parseGateTestStatus(undefined), undefined);
});

test("parseGateTestStatus: invalid value throws", () => {
  assert.throws(
    () => parseGateTestStatus("passsed"),
    /invalid --test-status: passsed/
  );
});
