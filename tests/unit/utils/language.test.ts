import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectLanguage,
  detectPrimaryLanguage,
  isCodeFile
} from "../../../src/utils/language.js";

test("detectLanguage: ts/js/py/go", () => {
  assert.equal(detectLanguage("src/a.ts"), "typescript");
  assert.equal(detectLanguage("src/a.js"), "javascript");
  assert.equal(detectLanguage("app/a.py"), "python");
  assert.equal(detectLanguage("cmd/a.go"), "go");
  assert.equal(detectLanguage("README.md"), "unknown");
});

test("detectPrimaryLanguage: most frequent code language wins", () => {
  assert.equal(
    detectPrimaryLanguage(["a.py", "b.py", "c.ts", "README.md"]),
    "python"
  );
});

test("isCodeFile: code vs non-code", () => {
  assert.equal(isCodeFile("a.go"), true);
  assert.equal(isCodeFile("a.py"), true);
  assert.equal(isCodeFile("a.md"), false);
});
