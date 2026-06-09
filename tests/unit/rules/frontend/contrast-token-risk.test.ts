import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastTokenRiskRule } from "../../../../src/rules/frontend/contrast-token-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "contrast-token-risk";

// TP: extreme color (#fff) in a .css added line with no var(--) -> info finding.
test("contrast-token-risk: #fff in css without var triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/theme.css", {
        addedLines: ["  color: #fff;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "info"),
    "expected an info finding for #fff without a CSS variable"
  );
});

// TP: long-form #ffffff is matched via the ffffff alternative + word boundary.
test("contrast-token-risk: #ffffff long form also triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("styles/buttons.scss", {
        status: "added",
        addedLines: ["  background: #FFFFFF;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.severity === "info").length, 1);
  assert.equal(out[0]?.file, "styles/buttons.scss");
  assert.equal(out[0]?.line, 1);
});

// TP: #000 (black) is also an extreme color.
test("contrast-token-risk: #000 black without var triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("a.sass", {
        addedLines: ["color: #000;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "info"));
});

// TN (guarded): same extreme color but wrapped in var(--...) on the line -> no finding.
test("contrast-token-risk: var(--...) fallback on same line suppresses finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/theme.css", {
        addedLines: ["  color: var(--fg, #fff);"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: extreme color in a non-CSS file (path filter) -> no finding.
test("contrast-token-risk: extreme color in .ts file is ignored (path filter)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/component.ts", {
        addedLines: ['const c = "#fff";']
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: deleted css file is skipped even if it contains an extreme color.
test("contrast-token-risk: deleted css file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("old.css", {
        status: "deleted",
        addedLines: ["color: #000;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: a non-extreme color (#fafafa) must not match the regex -> no finding.
test("contrast-token-risk: near-white #fafafa is not an extreme color", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/theme.css", {
        addedLines: ["  color: #fafafa;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: word-boundary means #fffa (4-hex) does NOT match #fff (no \b) nor #ffffff.
test("contrast-token-risk: #fffa (4-digit hex) does not trigger (word boundary)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/theme.css", {
        addedLines: ["  color: #fffa;"]
      })
    ])
  });
  const out = await contrastTokenRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Empty diff -> no findings.
test("contrast-token-risk: empty diff yields no findings", async () => {
  const out = await contrastTokenRiskRule.run(mockCtx());
  assert.equal(out.length, 0);
});
