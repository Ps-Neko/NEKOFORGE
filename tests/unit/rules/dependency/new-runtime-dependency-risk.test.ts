import { test } from "node:test";
import assert from "node:assert/strict";
import { newRuntimeDependencyRiskRule } from "../../../../src/rules/dependency/new-runtime-dependency-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "new-runtime-dependency-risk";

// TP: a new dependency line added to package.json fires an `info` finding.
test("new-runtime-dependency-risk: added dependency line triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "left-pad": "^1.3.0",']
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "info");
  assert.equal(hits[0].file, "package.json");
  // first matching added line is index 0 -> reported as 1-based line 1.
  assert.equal(hits[0].line, 1);
});

// TP: multiple dependency lines -> count reflected in message, still single info.
test("new-runtime-dependency-risk: counts multiple added dependency lines", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '    "react": "^18.2.0",',
          '    "lodash": "~4.17.21",',
          '    "zod": "3.22.4"'
        ]
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "info");
  assert.match(hits[0].message, /3 dependency line\(s\) added/);
});

// Boundary: devDependencies section touched -> still fires, but message is annotated.
test("new-runtime-dependency-risk: devDependencies touch annotates message (does not suppress)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '  "devDependencies": {',
          '    "vitest": "^1.0.0",'
        ]
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /devDependencies section also touched/);
});

// TN: package.json edits whose added values are non-numeric strings -> no finding.
// NOTE: a numeric-valued key like "version": "2.0.0" WOULD match DEP_LINE_RE (rule
// heuristic cannot distinguish it from a dependency), so this case deliberately uses
// only non-numeric values to stay clean.
test("new-runtime-dependency-risk: non-numeric-valued package.json edits are clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "license": "MIT",', '  "name": "my-pkg"'],
        deletedLines: ['  "license": "ISC",']
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Boundary/regex-evasion: non-numeric version specs are not matched by DEP_LINE_RE.
test("new-runtime-dependency-risk: non-numeric version specifiers do not match", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '    "foo": "latest",',
          '    "bar": "*",',
          '    "baz": "git+https://example.com/baz.git"'
        ]
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// TN: dependency-shaped line in a non-package.json file is ignored.
test("new-runtime-dependency-risk: non-package.json files are not scanned", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/config.json", {
        addedLines: ['    "left-pad": "^1.3.0",']
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// TN: a deleted package.json is skipped even if added lines look like deps.
test("new-runtime-dependency-risk: deleted package.json is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        status: "deleted",
        addedLines: ['    "left-pad": "^1.3.0",']
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Boundary: nested package.json path (e.g. packages/x/package.json) is matched.
test("new-runtime-dependency-risk: nested package.json path is matched", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/x/package.json", {
        addedLines: ['    "chalk": "^5.3.0"']
      })
    ])
  });
  const out = await newRuntimeDependencyRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, "packages/x/package.json");
});
