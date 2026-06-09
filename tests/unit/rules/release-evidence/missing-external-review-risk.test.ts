import { test } from "node:test";
import assert from "node:assert/strict";
import { missingExternalReviewRiskRule } from "../../../../src/rules/release-evidence/missing-external-review-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-external-review-risk";

// TP: RELEASE-NOTES with a version bump but no external-review keyword -> info.
test("missing-external-review-risk: version bump without review mention triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v1.2.3", "- fixed parser bug"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.severity === "info" && f.ruleId === RULE_ID).length, 1);
});

// TP variant: nested path + "## 4" style bump (matches /##\s*v?\d/) still fires.
test("missing-external-review-risk: nested RELEASE-NOTES with bare numeric heading fires", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/RELEASE-NOTES.md", {
        addedLines: ["## 4", "- maintenance release"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "info" && f.ruleId === RULE_ID));
});

// TN (guarded): version bump WITH external review keyword -> no finding.
test("missing-external-review-risk: version bump with 'codex review' mention is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v1.2.3", "- passed codex review before release"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: not a RELEASE-NOTES file at all -> rule short-circuits.
test("missing-external-review-risk: non-release-notes file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("CHANGELOG.md", {
        addedLines: ["## v1.2.3", "- something changed"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: RELEASE-NOTES present but no version-bump pattern in added lines -> no finding.
test("missing-external-review-risk: RELEASE-NOTES edit without version bump does not fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["- typo fix in prose", "thanks to contributors"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary (keyword case-insensitivity): "Self-Review" with mixed case still suppresses.
test("missing-external-review-risk: mixed-case 'Self-Review' keyword suppresses the finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v2.0.0", "- Self-Review completed by maintainer"]
      })
    ])
  });
  const out = await missingExternalReviewRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
