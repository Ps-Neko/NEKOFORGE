import { test } from "node:test";
import assert from "node:assert/strict";
import { interactiveDivRiskRule } from "../../../../src/rules/frontend/interactive-div-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

// TP: <div onClick> with no role attribute fires a warning.
test("interactive-div-risk: div with onClick and no role triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Card.tsx", {
        status: "modified",
        addedLines: ['<div onClick={handleClick}>click me</div>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.ok(findings.some((f) => f.severity === "warning"));
  assert.equal(findings[0]?.file, "src/ui/Card.tsx");
  assert.equal(findings[0]?.line, 1);
});

// TP: <span onKeyDown> with no role also fires (span path).
test("interactive-div-risk: span with onKeyDown and no role triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Item.jsx", {
        addedLines: ['<span onKeyDown={onKey}>x</span>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "warning");
});

// TN (guarded): role attribute present on the div suppresses the finding.
test("interactive-div-risk: div with onClick and role is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Card.tsx", {
        addedLines: ['<div role="button" onClick={handleClick}>ok</div>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 0);
});

// TN: a real <button> with onClick is fine — only div/span are scanned.
test("interactive-div-risk: button with onClick is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Card.tsx", {
        addedLines: ['<button onClick={handleClick}>ok</button>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 0);
});

// Boundary: non-frontend extension (.ts) is skipped even with a risky div.
test("interactive-div-risk: non-tsx/jsx/html file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Card.ts", {
        addedLines: ['<div onClick={handleClick}>x</div>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 0);
});

// Boundary: deleted file is skipped even if its added lines (renamed/moved) look risky.
test("interactive-div-risk: deleted file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Old.tsx", {
        status: "deleted",
        addedLines: ['<div onClick={handleClick}>x</div>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 0);
});

// Boundary (known regex gap): span with onMouseDown only is NOT caught.
// SPAN_INTERACTIVE_RE only matches onClick/onKeyDown for <span> (no onMouseDown),
// unlike DIV_INTERACTIVE_RE which includes onMouseDown. Asserting actual behavior.
test("interactive-div-risk: span with only onMouseDown is not flagged (regex gap)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/ui/Item.tsx", {
        addedLines: ['<span onMouseDown={onDown}>x</span>']
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 0);
});

// Boundary (line attribution): line number reflects the 1-based index within addedLines.
test("interactive-div-risk: reports correct 1-based line index", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("page.html", {
        addedLines: [
          '<header>safe</header>',
          '<div onMouseDown={drag}>handle</div>'
        ]
      })
    ])
  });
  const out = await interactiveDivRiskRule.run(ctx);
  const findings = out.filter((f) => f.ruleId === "interactive-div-risk");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.line, 2);
});
