import { test } from "node:test";
import assert from "node:assert/strict";
import { noTestRiskRule } from "../../../../src/rules/process/no-test-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

test("no-test-risk: src changed and no tests changed triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/foo.ts", { addedLines: ["export const x = 1;"] })])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "warning");
});

test("no-test-risk: testFirst policy escalates to high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/foo.ts", { addedLines: ["export const x = 1;"] })]),
    policies: { testFirst: true }
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out[0]?.severity, "high");
});

test("no-test-risk: multiple src files without tests still 1 finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/a.ts", { addedLines: ["const a = 1;"] }),
      fc("src/b.ts", { addedLines: ["const b = 2;"] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("no-test-risk: src + tests changed is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/foo.ts", { addedLines: ["export const x = 1;"] }),
      fc("tests/unit/foo.test.ts", { addedLines: ["test('x', () => {});"] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("no-test-risk: only docs changed is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("docs/X.md", { addedLines: ["hello"] })])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("no-test-risk: only import-reorder src change is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: ["import a from 'a';", "import b from 'b';"],
        deletedLines: ["import b from 'b';", "import a from 'a';"]
      })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// --- Gap 4: empty/trivial test file defeats the gate (FN) ---
test("no-test-risk: src change + only an EMPTY test file still triggers (FN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/foo.ts", { addedLines: ["export function f() { return 2; }"] }),
      fc("tests/foo.test.ts", { addedLines: [] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("no-test-risk: src change + comment-only test file still triggers (FN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/foo.ts", { addedLines: ["export function f() { return 2; }"] }),
      fc("tests/foo.test.ts", {
        addedLines: ["// TODO: write tests later", "", "describe('foo', () => {});"]
      })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("no-test-risk: src change + .skip-only test file still triggers (FN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/foo.ts", { addedLines: ["export function f() { return 2; }"] }),
      fc("tests/foo.test.ts", {
        addedLines: ['it.skip("later", () => { assert.ok(true); });']
      })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("no-test-risk: src change + REAL test file is ok (TN, no over-correction)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/foo.ts", { addedLines: ["export function f() { return 2; }"] }),
      fc("tests/foo.test.ts", {
        addedLines: ['test("f returns 2", () => { assert.equal(f(), 2); });']
      })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// --- Gap 5: generated artifacts should not be treated as src needing tests (FP) ---
test("no-test-risk: src/generated change is NOT flagged (FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/generated/api.ts", { addedLines: ["export const X = 1;"] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("no-test-risk: *.gen.ts change is NOT flagged (FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schema.gen.ts", { addedLines: ["export const Y = 2;"] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
