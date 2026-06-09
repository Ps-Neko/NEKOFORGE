import { test } from "node:test";
import assert from "node:assert/strict";
import { postinstallScriptRiskRule } from "../../../../src/rules/dependency/postinstall-script-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

// TP: adding a postinstall lifecycle script to package.json fires a warning.
test("postinstall-script-risk: added postinstall script triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "postinstall": "node ./scripts/setup.js",']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "warning"));
  assert.equal(out[0]?.ruleId, "postinstall-script-risk");
  assert.equal(out[0]?.file, "package.json");
});

// TP: nested package.json path is matched too, all four lifecycle keys fire.
test("postinstall-script-risk: nested package.json with preinstall/prepare/prepublish fires", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/app/package.json", {
        addedLines: [
          '    "preinstall": "echo pre",',
          '    "prepare": "husky install",',
          '    "prepublish": "build"'
        ]
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 3);
  assert.ok(out.every((f) => f.severity === "warning"));
  assert.ok(out.every((f) => f.file === "packages/app/package.json"));
});

// TN: a non-package.json file with a postinstall-looking line does NOT fire
// (rule only scans files whose basename is exactly package.json).
test("postinstall-script-risk: postinstall string in a .js file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/installer.js", {
        addedLines: ['  const hook = "postinstall": runScript();']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: clean package.json change (a normal dependency / non-lifecycle script)
// must not fire.
test("postinstall-script-risk: ordinary package.json edit does not fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '    "build": "tsc",',
          '    "test": "node --test",',
          '    "lodash": "^4.17.21"'
        ]
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN / boundary: deleted package.json is skipped even if a lifecycle line
// appears in addedLines.
test("postinstall-script-risk: deleted package.json is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        status: "deleted",
        addedLines: ['    "postinstall": "node setup.js",']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: the regex requires the key in double quotes followed immediately by
// a colon. A space before the colon evades detection (rule limitation).
test("postinstall-script-risk: space before colon evades the regex (limitation)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "postinstall" : "node setup.js",']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// Boundary: similarly named file (mypackage.json) IS matched because the regex
// anchors on (^|/) — but "package.json.bak" is NOT, confirming basename anchor.
test("postinstall-script-risk: package.json.bak is not treated as package.json", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json.bak", {
        addedLines: ['    "postinstall": "node setup.js",']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
