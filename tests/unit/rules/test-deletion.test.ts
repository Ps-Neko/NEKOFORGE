import { test } from "node:test";
import assert from "node:assert/strict";
import { testDeletionRule } from "../../../src/rules/test-deletion.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

test("test-deletion: deleted file under tests/ triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("tests/auth.test.ts", { status: "deleted" })])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("test-deletion: deleted *.test.ts (not under tests/) triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/auth.test.ts", { status: "deleted" })])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("test-deletion: skip marker added triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/x.test.ts", {
        addedLines: ['test.skip("disabled for now", () => {});']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("test-deletion: pytest.mark.skip triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/foo_test.py", { addedLines: ["@pytest.mark.skip(reason='wip')"] })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("test-deletion: deleted non-test file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/old.ts", { status: "deleted" })])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});

test("test-deletion: skip marker already present in deleted lines is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/x.test.ts", {
        addedLines: ['test.skip("relocated", () => {});'],
        deletedLines: ['test.skip("relocated", () => {});']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});
