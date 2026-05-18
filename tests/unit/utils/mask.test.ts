import { test } from "node:test";
import assert from "node:assert/strict";
import { maskSecrets, looksLikeSecret } from "../../../src/utils/mask.js";

test("maskSecrets: masks 24+ char tokens but keeps first 4", () => {
  const out = maskSecrets("API_KEY=abcdef1234567890ABCDEF1234567890");
  assert.match(out, /^API_KEY=abcd\*+/);
});

test("maskSecrets: leaves short tokens alone", () => {
  assert.equal(maskSecrets("x=short"), "x=short");
});

test("maskSecrets: leaves short common literal 'undefined' alone", () => {
  assert.equal(maskSecrets("v=undefined"), "v=undefined");
});

test("looksLikeSecret: typical token returns true", () => {
  assert.ok(looksLikeSecret("sk_test_abcd1234"));
});

test("looksLikeSecret: short value returns false", () => {
  assert.equal(looksLikeSecret("hi"), false);
});

test("looksLikeSecret: PEM header returns true", () => {
  assert.ok(looksLikeSecret("-----BEGIN PRIVATE KEY-----"));
});
