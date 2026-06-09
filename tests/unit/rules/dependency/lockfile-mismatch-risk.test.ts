import { test } from "node:test";
import assert from "node:assert/strict";
import { lockfileMismatchRiskRule } from "../../../../src/rules/dependency/lockfile-mismatch-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "lockfile-mismatch-risk";

// TP: package.json dependency added, no lockfile in the diff -> warning fires.
test("lockfile-mismatch: dep added without lockfile triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "lodash": "^4.17.21",']
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"),
    "expected a warning finding for dep-without-lockfile"
  );
});

// TP: the "latest" / "*" alternation branch of the dep-change regex also fires.
test('lockfile-mismatch: "latest" dependency without lockfile triggers warning', async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "left-pad": "latest"']
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"),
    'expected a warning for a "latest" dependency'
  );
});

// TN: package.json dep added AND lockfile touched in the same diff -> guarded, no finding.
test("lockfile-mismatch: dep added with lockfile touched is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "lodash": "^4.17.21",']
      }),
      fc("package-lock.json", {
        addedLines: ['        "node_modules/lodash": {}']
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "lockfile touched in same diff must suppress the finding"
  );
});

// TN / boundary: package.json touched but only a scripts change (no dep-version pattern) -> no finding.
test("lockfile-mismatch: scripts-only package.json change does not fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "build": "tsc -p tsconfig.json",']
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "a non-dependency (scripts) line must not be read as a dep change"
  );
});

// Boundary: no package.json in the diff at all -> early return, no finding.
test("lockfile-mismatch: diff without package.json does not fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/index.ts", {
        addedLines: ['import lodash from "lodash";']
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.equal(out.length, 0, "no package.json means the rule is inert");
});

// Boundary: nested package.json with a sibling nested lockfile -> path-anchored regex + guard, clean.
test("lockfile-mismatch: nested package.json with nested lockfile is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/app/package.json", {
        addedLines: ['    "express": "~4.18.2",']
      }),
      fc("packages/app/pnpm-lock.yaml", {
        addedLines: ["  express@4.18.2:"]
      })
    ])
  });
  const out = await lockfileMismatchRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "nested lockfile in the same diff must suppress the finding"
  );
});
