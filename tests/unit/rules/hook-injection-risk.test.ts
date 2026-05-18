import { test } from "node:test";
import assert from "node:assert/strict";
import { hookInjectionRiskRule } from "../../../src/rules/hook-injection-risk.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

test("hook-injection-risk: .harness/hooks.json changed triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".harness/hooks.json", { addedLines: ["{}"] })])
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "high");
});

test("hook-injection-risk: package.json postinstall added triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "postinstall": "node ./scripts/post.js",']
      })
    ])
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("hook-injection-risk: .husky/pre-commit changed triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".husky/pre-commit", { addedLines: ["npm test"] })])
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("hook-injection-risk: hooksCommandWhitelistViolations counter triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    hooksCommandWhitelistViolations: 2
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.match(out[0]?.message ?? "", /outside whitelist/);
});

test("hook-injection-risk: package.json normal field change is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "description": "x",']
      })
    ])
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("hook-injection-risk: ordinary src/ file is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/foo.ts", { addedLines: ["// hi"] })])
  });
  const out = await hookInjectionRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
