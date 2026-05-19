/**
 * Phase QF — architecture/design rule 단위 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { largeFileRiskRule } from "../../src/rules/architecture/large-file-risk.js";
import { layerViolationRule } from "../../src/rules/architecture/layer-violation.js";
import { untypedApiRiskRule } from "../../src/rules/architecture/untyped-api-risk.js";
import { circularDependencyRiskRule } from "../../src/rules/architecture/circular-dependency-risk.js";
import { accessibilityRiskRule } from "../../src/rules/design/accessibility-risk.js";
import { designTokenViolationRule } from "../../src/rules/design/design-token-violation.js";
import { responsiveBreakRiskRule } from "../../src/rules/design/responsive-break-risk.js";
import { fc, diffOf, mockCtx } from "./rules/_helpers.js";

// === large-file-risk ===
test("large-file-risk: +700 lines → high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/big.ts", {
        addedLines: Array.from({ length: 700 }, (_, i) => `line ${i}`)
      })
    ])
  });
  const out = await largeFileRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("large-file-risk: +350 lines → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/mid.ts", {
        addedLines: Array.from({ length: 350 }, (_, i) => `line ${i}`)
      })
    ])
  });
  const out = await largeFileRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "warning"));
});

test("large-file-risk: +50 lines → no finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/small.ts", {
        addedLines: Array.from({ length: 50 }, () => "x")
      })
    ])
  });
  assert.equal((await largeFileRiskRule.run(ctx)).length, 0);
});

// === layer-violation ===
test("layer-violation: .claude/ → .harness reverse triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: [
          'import { team } from "../.claude/agents/impl-1.harness/team.json";'
        ]
      })
    ])
  });
  const out = await layerViolationRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

// === untyped-api-risk ===
test("untyped-api-risk: `as any` → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: ["const r = (data as any).result;"]
      })
    ])
  });
  const out = await untypedApiRiskRule.run(ctx);
  assert.ok(out.some((f) => /as any/.test(f.message)));
});

test("untyped-api-risk: explicit `: any` → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: ["function fn(x: any) { return x; }"]
      })
    ])
  });
  const out = await untypedApiRiskRule.run(ctx);
  assert.ok(out.length >= 1);
});

// === circular-dependency-risk ===
test("circular-dependency-risk: 3+ sibling imports → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/core/a/index.ts", {
        addedLines: [
          'import { x } from "../b/index.js";',
          'import { y } from "../c/index.js";',
          'import { z } from "../d/index.js";'
        ]
      })
    ])
  });
  const out = await circularDependencyRiskRule.run(ctx);
  assert.ok(out.length >= 1);
});

// === accessibility-risk ===
test("accessibility-risk: <img> without alt → high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Avatar.tsx", {
        addedLines: ['<img src="/me.png" />']
      })
    ])
  });
  const out = await accessibilityRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("accessibility-risk: <img> with alt → no finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Avatar.tsx", {
        addedLines: ['<img src="/me.png" alt="me" />']
      })
    ])
  });
  const out = await accessibilityRiskRule.run(ctx);
  assert.equal(out.filter((f) => /alt/.test(f.message)).length, 0);
});

// === design-token-violation ===
test("design-token-violation: hardcoded hex in tsx style → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Btn.tsx", {
        addedLines: ['<div style={{ color: "#ff0000" }}>x</div>']
      })
    ])
  });
  const out = await designTokenViolationRule.run(ctx);
  assert.ok(out.length >= 1);
});

test("design-token-violation: hex in css triggers", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Btn.scss", {
        addedLines: [".btn { color: #1234ab; }"]
      })
    ])
  });
  const out = await designTokenViolationRule.run(ctx);
  assert.ok(out.length >= 1);
});

// === responsive-break-risk ===
test("responsive-break-risk: fixed width without @media → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/L.scss", {
        addedLines: [".col { width: 800px; }"]
      })
    ])
  });
  const out = await responsiveBreakRiskRule.run(ctx);
  assert.ok(out.length >= 1);
});

test("responsive-break-risk: fixed width WITH @media → ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/L.scss", {
        addedLines: [
          "@media (min-width: 768px) {",
          "  .col { width: 800px; }",
          "}"
        ]
      })
    ])
  });
  const out = await responsiveBreakRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
