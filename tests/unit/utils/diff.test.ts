import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnifiedDiff, makeFileChange } from "../../../src/utils/diff.js";

test("parseUnifiedDiff: extracts added and deleted lines", () => {
  const raw = [
    "diff --git a/src/a.ts b/src/a.ts",
    "index abc..def 100644",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,3 @@",
    " const x = 1;",
    "-const y = 2;",
    "+const y = 22;",
    " export {};"
  ].join("\n");
  const diff = parseUnifiedDiff(raw);
  assert.equal(diff.files.length, 1);
  assert.equal(diff.files[0]?.path, "src/a.ts");
  assert.deepEqual(diff.files[0]?.addedLines, ["const y = 22;"]);
  assert.deepEqual(diff.files[0]?.deletedLines, ["const y = 2;"]);
});

test("parseUnifiedDiff: marks new files as added", () => {
  const raw = [
    "diff --git a/src/new.ts b/src/new.ts",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/src/new.ts",
    "@@ -0,0 +1,1 @@",
    "+export const k = 1;"
  ].join("\n");
  const diff = parseUnifiedDiff(raw);
  assert.equal(diff.files[0]?.status, "added");
});

test("parseUnifiedDiff: marks deleted files", () => {
  const raw = [
    "diff --git a/src/gone.ts b/src/gone.ts",
    "deleted file mode 100644",
    "--- a/src/gone.ts",
    "+++ /dev/null",
    "@@ -1,1 +0,0 @@",
    "-export const k = 1;"
  ].join("\n");
  const diff = parseUnifiedDiff(raw);
  assert.equal(diff.files[0]?.status, "deleted");
});

test("makeFileChange: defaults are sensible", () => {
  const fc = makeFileChange("src/a.ts");
  assert.equal(fc.status, "modified");
  assert.deepEqual(fc.addedLines, []);
  assert.deepEqual(fc.deletedLines, []);
});
