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

test("large-file-risk: generated lockfile +700 lines → no FP", async () => {
  // GAP4 FP: generated artifacts (lockfiles, snapshots, .d.ts, min bundles)
  // are not hand-maintained source and must not trip the large-file rule.
  for (const path of [
    "package-lock.json",
    "pnpm-lock.yaml",
    "src/__snapshots__/x.snap",
    "dist/types/index.d.ts",
    "tests/fixtures/big-fixture.json"
  ]) {
    const ctx = mockCtx({
      diff: diffOf([
        fc(path, {
          addedLines: Array.from({ length: 700 }, (_, i) => `line ${i}`)
        })
      ])
    });
    const out = await largeFileRiskRule.run(ctx);
    assert.equal(out.length, 0, `${path} must not be flagged as large file`);
  }
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

test("layer-violation: multiline import (from on own line) → still detected", async () => {
  // GAP1 FN: import statement split across lines — the `from "../core/..."`
  // line is not prefixed by `import` so the pre-filter dropped it.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/integrations/x.ts", {
        addedLines: [
          "import {",
          "  loadArtifact",
          '} from "../core/work/index.js";'
        ]
      })
    ])
  });
  const out = await layerViolationRule.run(ctx);
  assert.ok(
    out.some((f) => f.severity === "critical"),
    "multiline integrations → core import must be caught"
  );
});

test("layer-violation: core helper under nested utils path → no FP", async () => {
  // GAP1 FP: a core file whose path merely *contains* `utils/` deep inside
  // (not a leaf utils dir) was misfiring on the utils→core/cli rule.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/core/work/utils/helper.ts", {
        addedLines: ['import { run } from "../../cli/index.js";']
      })
    ])
  });
  const out = await layerViolationRule.run(ctx);
  assert.equal(
    out.filter((f) => /leaf only/.test(f.message)).length,
    0,
    "core/**/utils helper must not trip the utils→core/cli leaf rule"
  );
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

test("untyped-api-risk: arrow export returning Promise<any> → warning", async () => {
  // GAP2 FN: `: any` inside `Promise<any>` was not matched by /:\s*any\b/
  // because of the `<` immediately before any.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: ["export const load = async (): Promise<any> => ({});"]
      })
    ])
  });
  const out = await untypedApiRiskRule.run(ctx);
  assert.ok(out.length >= 1, "Promise<any> must be flagged");
});

test("untyped-api-risk: default-value fn call in params → no FP", async () => {
  // GAP2 FP: a public function whose parameter has a default that is a function
  // call (inner parens) must NOT be reported as missing a return type when one
  // is present.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/x.ts", {
        addedLines: ["export function make(opts = defaults()): Widget {"]
      })
    ])
  });
  const out = await untypedApiRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => /missing return type/.test(f.message)).length,
    0,
    "function with explicit return type must not be flagged as missing it"
  );
});

// === circular-dependency-risk ===
test("circular-dependency-risk: leaf util/type sibling imports → no FP", async () => {
  // GAP3 FP: importing from leaf util/type/constant sibling folders is benign
  // and should not be flagged as a cycle candidate.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/core/a/index.ts", {
        addedLines: [
          'import { x } from "../utils/format.js";',
          'import { y } from "../types/model.js";',
          'import { z } from "../constants/keys.js";'
        ]
      })
    ])
  });
  const out = await circularDependencyRiskRule.run(ctx);
  assert.equal(
    out.length,
    0,
    "leaf util/type/constant sibling imports must not trip the cycle heuristic"
  );
});

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

test("accessibility-risk: multiline <img> with alt on later line → no FP", async () => {
  // GAP5 FP: an <img> tag whose `alt` attribute lives on a subsequent line was
  // wrongly flagged because each line is scanned in isolation.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Avatar.tsx", {
        addedLines: ["<img", '  src="/me.png"', '  alt="me"', "/>"]
      })
    ])
  });
  const out = await accessibilityRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => /alt/.test(f.message)).length,
    0,
    "multiline <img> with alt must not be flagged as missing alt"
  );
});

test("accessibility-risk: multiline <img> without alt → still high", async () => {
  // GAP5 TP-guard: a genuinely alt-less multiline <img> must still fire.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/Avatar.tsx", {
        addedLines: ["<img", '  src="/me.png"', '  width={40}', "/>"]
      })
    ])
  });
  const out = await accessibilityRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.severity === "high"),
    "multiline <img> without alt must still be flagged"
  );
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
