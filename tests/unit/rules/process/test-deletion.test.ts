import { test } from "node:test";
import assert from "node:assert/strict";
import { testDeletionRule } from "../../../../src/rules/process/test-deletion.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

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

// --- Gap 2a: trivial-added defeats shrink check ---
test("test-deletion: large shrink with trivial added lines still triggers high (FN-a)", async () => {
  const deleted = Array.from({ length: 30 }, (_, i) => `  assert.equal(x, ${i});`);
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/big.test.ts", {
        // attacker adds a comment + blank + describe shell to make addedLines != 0
        addedLines: ["// removed flaky", "", "describe('x', () => {"],
        deletedLines: deleted
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("test-deletion: large shrink with real added test lines does NOT trigger (TN-a)", async () => {
  const deleted = Array.from({ length: 30 }, (_, i) => `  assert.equal(x, ${i});`);
  const added = Array.from({ length: 25 }, (_, i) => `  assert.deepEqual(y, ${i});`);
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/big.test.ts", { addedLines: added, deletedLines: deleted })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});

// --- Gap 2b: .only( mass-disable ---
test("test-deletion: .only( marker added triggers high (FN-b)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/x.test.ts", {
        addedLines: ['it.only("just this one", () => {});']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

// --- Gap 2c: renamed test -> non-test extension parking ---
test("test-deletion: test renamed to non-test extension triggers (FN-c)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/auth.test.ts.bak", {
        status: "renamed",
        oldPath: "tests/auth.test.ts"
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical" || f.severity === "high"));
});

test("test-deletion: test renamed to another test path does NOT trigger (TN-c)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/unit/auth.test.ts", {
        status: "renamed",
        oldPath: "tests/auth.test.ts"
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});

// --- Gap 2d: .skip ( whitespace bypass ---
test("test-deletion: '.skip (' with whitespace triggers high (FN-d)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/x.test.ts", {
        addedLines: ['test.skip ("sneaky whitespace", () => {});']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

// --- Gap 3: FP — skip markers in production code ---
test("test-deletion: ORM query.skip() in production code is NOT flagged (FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/repo/users.ts", {
        addedLines: ["const rows = await query.skip(10).take(5);"]
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});

test("test-deletion: t.Skip( in production comment is NOT flagged (FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/runner.go", {
        addedLines: ["// when CI is green we no longer call t.Skip( here"]
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.equal(out.length, 0);
});
