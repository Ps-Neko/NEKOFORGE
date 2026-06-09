import { test } from "node:test";
import assert from "node:assert/strict";
import { missingCliDocRiskRule } from "../../../../src/rules/docs/missing-cli-doc-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-cli-doc-risk";

test("missing-cli-doc-risk: TP — new CLI command file added without docs/CLI.md triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.ts", {
        status: "added",
        addedLines: ["export function ship() {}"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"),
    "expected a warning finding for new CLI command without doc"
  );
  const finding = out.find((f) => f.ruleId === RULE_ID);
  assert.equal(finding?.file, "src/cli/commands/ship.ts");
});

test("missing-cli-doc-risk: TP — count reflected and first file reported when multiple new CLI files", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.ts", {
        status: "added",
        addedLines: ["export function ship() {}"]
      }),
      fc("src/cli/commands/land.ts", {
        status: "added",
        addedLines: ["export function land() {}"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  const finding = out.find((f) => f.ruleId === RULE_ID);
  assert.ok(finding, "expected a finding");
  assert.match(finding!.message, /2 new CLI command file\(s\)/);
  assert.equal(finding!.file, "src/cli/commands/ship.ts");
});

test("missing-cli-doc-risk: TN — new CLI command file with docs/CLI.md touched does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.ts", {
        status: "added",
        addedLines: ["export function ship() {}"]
      }),
      fc("docs/CLI.md", {
        status: "modified",
        addedLines: ["## ship", "Run the ship command."]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "doc was touched, so no finding expected"
  );
});

test("missing-cli-doc-risk: TN — modified (not added) CLI command file does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.ts", {
        status: "modified",
        addedLines: ["// tweak"],
        deletedLines: ["// old"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "only added CLI files are considered; modified must not fire"
  );
});

test("missing-cli-doc-risk: TN — unrelated added file outside src/cli/commands does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/core/work.ts", {
        status: "added",
        addedLines: ["export const x = 1;"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

test("missing-cli-doc-risk: boundary — non-.ts added CLI file is not matched (regex requires .ts)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.js", {
        status: "added",
        addedLines: ["module.exports = {};"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "CLI_COMMAND_RE only matches .ts files"
  );
});

test("missing-cli-doc-risk: boundary — docs/CLI.md match is case-insensitive (docs/cli.md guards)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/cli/commands/ship.ts", {
        status: "added",
        addedLines: ["export function ship() {}"]
      }),
      fc("docs/cli.md", {
        status: "modified",
        addedLines: ["doc"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "CLI_DOC_RE has the i flag, so docs/cli.md counts as touched"
  );
});

test("missing-cli-doc-risk: boundary — nested path prefix still matches CLI command regex", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/app/src/cli/commands/deploy.ts", {
        status: "added",
        addedLines: ["export function deploy() {}"]
      })
    ])
  });
  const out = await missingCliDocRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"),
    "(^|/) anchor allows a path prefix before src/cli/commands"
  );
});
