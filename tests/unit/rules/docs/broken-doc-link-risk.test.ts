import { test } from "node:test";
import assert from "node:assert/strict";
import { brokenDocLinkRiskRule } from "../../../../src/rules/docs/broken-doc-link-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

// TP: a new relative `](docs/...md)` link whose target is absent from the diff → info finding.
test("broken-doc-link-risk: new docs/ link to absent target triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("README.md", {
        status: "modified",
        addedLines: ["See the [guide](docs/guide.md) for details."]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.ok(out.some((f) => f.severity === "info"));
  assert.equal(out[0]?.ruleId, "broken-doc-link-risk");
  assert.equal(out[0]?.file, "README.md");
});

// TP: a `](../...md)` parent-relative link with no matching file in diff also fires.
test("broken-doc-link-risk: ../ relative link to absent target triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/intro.md", {
        status: "added",
        addedLines: ["Back to the [root readme](../README.md)."]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "info"));
  assert.equal(out.length, 1);
});

// TN: link target file is added in the same diff → guarded, no finding.
test("broken-doc-link-risk: link target present in same diff is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("README.md", {
        status: "modified",
        addedLines: ["See the [guide](docs/guide.md)."]
      }),
      fc("docs/guide.md", {
        status: "added",
        addedLines: ["# Guide"]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: external / non-relative links do not match the regex (no ./ ../ or docs/ prefix) → no finding.
test("broken-doc-link-risk: external and bare links are not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("README.md", {
        status: "modified",
        addedLines: [
          "Visit [site](https://example.com/page.md).",
          "Also [bare](guide.md) and [anchor](#section)."
        ]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: a deleted .md file is excluded from scanning even if its added lines contain a link.
test("broken-doc-link-risk: deleted md file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("old.md", {
        status: "deleted",
        addedLines: ["leftover [link](docs/missing.md)"]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: normalization only strips ONE leading ../, so a deep ../../ link whose
// target IS in the diff still fires because endsWith() can't reconcile the residual path.
// This documents the rule's imperfect (single-level) `../` stripping heuristic.
test("broken-doc-link-risk: deep ../../ link still fires despite target in diff (single-level strip)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("a/b/page.md", {
        status: "modified",
        // captured link = ../../docs/guide.md ; cleaned strips one ../ => ../docs/guide.md
        addedLines: ["[deep](../../docs/guide.md)"]
      }),
      fc("docs/guide.md", {
        status: "added",
        addedLines: ["# Guide"]
      })
    ])
  });
  const out = await brokenDocLinkRiskRule.run(ctx);
  // Despite docs/guide.md being present, the residual "../docs/guide.md" does not
  // endsWith any diff path, so the heuristic still emits an info finding.
  assert.ok(out.some((f) => f.severity === "info"));
});
