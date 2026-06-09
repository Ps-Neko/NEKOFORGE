import { test } from "node:test";
import assert from "node:assert/strict";
import { unboundedVersionRiskRule } from "../../../../src/rules/dependency/unbounded-version-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "unbounded-version-risk";

// TP: a bare "*" dependency version fires a warning.
test('unbounded-version-risk: "*" version triggers warning', async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "lodash": "*",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TP: ">=1.0.0" fires.
test('unbounded-version-risk: ">=1.0.0" triggers warning', async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "express": ">=1.0.0",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TP: "latest" inside a dependency line fires.
test('unbounded-version-risk: "latest" dependency triggers warning', async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "left-pad": "latest"']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TN: caret/tilde are normal and must not fire.
test("unbounded-version-risk: caret/tilde versions are clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "express": "^4.19.0",', '    "zod": "~3.22.0"']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: deleted package.json is skipped.
test("unbounded-version-risk: deleted package.json is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        status: "deleted",
        addedLines: ['    "lodash": "*",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// GAP 4 (FN): partial wildcard like "1.x" / "2.X" is unbounded but was missed
// because the old pattern only matched a bare "x".
test('unbounded-version-risk: partial wildcard "1.x" triggers warning', async () => {
  for (const v of ['    "a": "1.x",', '    "b": "2.X",', '    "c": "1.2.x"']) {
    const ctx = mockCtx({
      diff: diffOf([fc("package.json", { addedLines: [v] })])
    });
    const out = await unboundedVersionRiskRule.run(ctx);
    assert.ok(
      out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"),
      `expected warning for partial wildcard: ${v}`
    );
  }
});

// GAP 4 (FN): a leading space inside the quoted value (e.g. " >=1.0.0") used to
// evade the >= pattern. It must now be caught.
test("unbounded-version-risk: leading space before >= no longer evades", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "express": " >=1.0.0",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// GAP 4 (FP): publishConfig metadata like "tag": "latest" is NOT a dependency
// version and must not be flagged.
test("unbounded-version-risk: publishConfig tag:latest is not flagged (no FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '  "publishConfig": {',
          '    "tag": "latest",',
          '    "access": "public"'
        ]
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "publishConfig metadata must not be read as an unbounded dependency version"
  );
});

// TN: a top-level "version": "latest"-shaped meta field is not a dependency.
test("unbounded-version-risk: top-level meta field is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "version": "2.0.0",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: non-package.json files are not scanned.
test("unbounded-version-risk: non-package.json files are not scanned", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/config.json", {
        addedLines: ['    "lodash": "*",']
      })
    ])
  });
  const out = await unboundedVersionRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
