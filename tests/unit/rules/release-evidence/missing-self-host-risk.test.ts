import { test } from "node:test";
import assert from "node:assert/strict";
import { missingSelfHostRiskRule } from "../../../../src/rules/release-evidence/missing-self-host-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-self-host-risk";

// NOTE: the rule inspects only file *paths*, never added/deleted line content.
// Fires when a RELEASE-NOTES.md path is touched AND no examples/phase-self-host-*
// path is present in the same diff. Severity is "info".

// TP: RELEASE-NOTES.md edited, no self-host trace -> exactly one info finding.
test("missing-self-host-risk: release-notes change without self-host dir triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v1.4.0", "- shipped the gate"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  const hits = out.filter((f) => f.severity === "info" && f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.match(hits[0]!.message, /no examples\/phase-self-host/);
});

// TP variant: nested RELEASE-NOTES.md path (case-insensitive) still fires.
test("missing-self-host-risk: nested + mixed-case RELEASE-NOTES path fires", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/release-notes.md", {
        addedLines: ["- maintenance release"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "info" && f.ruleId === RULE_ID));
});

// TN (guarded): self-host trace present in the same diff -> suppressed.
test("missing-self-host-risk: release-notes WITH self-host example trace is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v1.4.0", "- shipped the gate"]
      }),
      fc("examples/phase-self-host-001/report.md", {
        status: "added",
        addedLines: ["self-host run passed"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: RELEASE-NOTES not touched at all -> rule short-circuits.
test("missing-self-host-risk: diff without RELEASE-NOTES is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("CHANGELOG.md", {
        addedLines: ["## v1.4.0", "- something changed"]
      }),
      fc("src/index.ts", {
        addedLines: ["export const x = 1;"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: substring path "FOO-RELEASE-NOTES.md" must NOT match the anchored
// (^|/)RELEASE-NOTES\.md$ regex -> no finding. Confirms the path anchor.
test("missing-self-host-risk: RELEASE-NOTES as a filename substring does not fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/FOO-RELEASE-NOTES.md", {
        addedLines: ["- not the real release notes file"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: self-host trace can live anywhere with examples/phase-self-host- in
// the path; the prefix match is not anchored to repo root, so a nested wrapper
// path still suppresses the finding.
test("missing-self-host-risk: nested examples/phase-self-host- path also suppresses", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", { addedLines: ["## v2.0.0"] }),
      fc("packages/core/examples/phase-self-host-cli/run.json", {
        status: "added",
        addedLines: ["{}"]
      })
    ])
  });
  const out = await missingSelfHostRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
