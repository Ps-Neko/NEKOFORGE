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

// GAP 3 (evasion closed): a space before the colon ("postinstall" : ...) used to
// evade detection. The lifecycle regex now tolerates optional whitespace before the
// colon, so this obfuscation is caught.
test("postinstall-script-risk: space before colon no longer evades detection", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['    "postinstall" : "node setup.js",']
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "warning");
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

// GAP 3 (FN): publish-time lifecycle keys prepublishOnly/prepack/postpack run code
// on the maintainer's machine during publish and were previously missed.
test("postinstall-script-risk: prepublishOnly/prepack/postpack lifecycle keys fire", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '  "scripts": {',
          '    "prepublishOnly": "node ./scripts/guard.js",',
          '    "prepack": "npm run build",',
          '    "postpack": "node ./scripts/cleanup.js"'
        ]
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 3, "all three publish-time lifecycle keys must fire");
  assert.ok(out.every((f) => f.severity === "warning"));
});

// GAP 3 (FP): a "prepare" key inside a tool-config block (release-it/husky/etc.)
// is NOT an npm lifecycle script and must not be flagged. Other npm lifecycle keys
// (postinstall) inside scripts still fire.
test("postinstall-script-risk: prepare inside a tool-config block does not fire (no FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '  "release-it": {',
          '    "hooks": {',
          '      "prepare": "npm run build"',
          '    }',
          '  }'
        ]
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(
    out.length,
    0,
    "prepare inside a non-scripts tool-config block must not be flagged"
  );
});

// TN: a "prepare" key inside the scripts section still fires (real npm lifecycle).
test("postinstall-script-risk: prepare inside scripts section still fires", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: [
          '  "scripts": {',
          '    "prepare": "husky install"'
        ]
      })
    ])
  });
  const out = await postinstallScriptRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "warning");
});
