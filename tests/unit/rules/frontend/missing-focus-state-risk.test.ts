import { test } from "node:test";
import assert from "node:assert/strict";
import { missingFocusStateRiskRule } from "../../../../src/rules/frontend/missing-focus-state-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-focus-state-risk";

// TP: .css with :hover added and no :focus -> warning
test("missing-focus-state-risk: :hover added without :focus triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [".btn:hover { color: blue; }"]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
  assert.equal(hits[0].file, "src/styles/button.css");
  // line is idx+1 of first added line containing :hover (1-based)
  assert.equal(hits[0].line, 1);
});

// TP: .scss also matched by the extension regex
test("missing-focus-state-risk: :hover added in .scss without :focus triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("ui/card.scss", {
        addedLines: ["// tweak", ".card:hover { transform: scale(1.02); }"]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
  // :hover is on the 2nd added line -> line === 2
  assert.equal(hits[0].line, 2);
});

// TN: :hover AND :focus both present in added lines -> no finding (guarded)
test("missing-focus-state-risk: :hover paired with :focus is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [
          ".btn:hover { color: blue; }",
          ".btn:focus { outline: 2px solid; }"
        ]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: :focus-visible also satisfies the guard (FOCUS_RE matches :focus(-visible)?)
test("missing-focus-state-risk: :focus-visible satisfies the guard", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [
          ".btn:hover { color: blue; }",
          ".btn:focus-visible { outline: 2px solid; }"
        ]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: non-CSS file with :hover is ignored (extension gate)
test("missing-focus-state-risk: :hover in non-CSS file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/Button.tsx", {
        addedLines: ['const cls = "btn:hover";']
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: deleted CSS file is skipped even if :hover present in added lines
test("missing-focus-state-risk: deleted CSS file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/old.css", {
        status: "deleted",
        addedLines: [".btn:hover { color: blue; }"]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: :focus present only in EXISTING (unchanged) code, not in the diff's
// added lines, so the rule still fires — it only inspects added lines.
test("missing-focus-state-risk: pre-existing :focus (not in added lines) does NOT suppress", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        // :focus lives in deletedLines / unchanged context, not addedLines
        deletedLines: [".btn:focus { outline: 2px solid; }"],
        addedLines: [".btn:hover { color: blue; }"]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
});

// Boundary: word-boundary on :hover — ":hovering" must NOT match (\b after hover).
test("missing-focus-state-risk: :hovering (no word boundary) does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [".btn:hovering { color: blue; }"]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// FN: a :focus on an UNRELATED selector must not suppress a :hover on a different selector.
test("missing-focus-state-risk: focus on unrelated selector does not suppress hover", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [
          ".btn:hover { color: blue; }",
          ".link:focus { outline: 2px solid; }"
        ]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1, ".btn:hover has no matching .btn:focus → must fire");
  assert.equal(hits[0].severity, "warning");
  assert.equal(hits[0].line, 1);
});

// TN: same-selector :focus suppresses its own :hover even when other selectors exist.
test("missing-focus-state-risk: matching same-selector focus suppresses (per-selector)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/button.css", {
        addedLines: [
          ".btn:hover { color: blue; }",
          ".btn:focus { outline: 2px solid; }",
          ".link:hover { color: red; }",
          ".link:focus-visible { outline: 1px solid; }"
        ]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "every hover has a same-selector focus → no finding"
  );
});

// FN: two hovers, only one has a matching focus → the unmatched one still fires.
test("missing-focus-state-risk: only unmatched hover fires when one pair is complete", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/styles/nav.css", {
        addedLines: [
          ".nav-item:hover { background: gray; }",
          ".nav-item:focus { background: gray; }",
          ".cta:hover { transform: scale(1.05); }"
        ]
      })
    ])
  });
  const out = await missingFocusStateRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1, ".cta:hover has no .cta:focus");
  assert.equal(hits[0].line, 3);
});
