/**
 * ⓒ 증거 무결성 — decision.json 의 canonical content hash.
 *
 * 키 순서에 독립적이어야 한다(파일을 읽고 다시 직렬화해도 동일 해시).
 * 내용이 한 글자라도 다르면 다른 해시여야 한다(변조 탐지).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalHash,
  extractLastDecisionHash
} from "../../../src/utils/integrity.js";

test("canonicalHash: key order independent", () => {
  assert.equal(canonicalHash({ x: 1, y: 2 }), canonicalHash({ y: 2, x: 1 }));
});

test("canonicalHash: different content → different hash", () => {
  assert.notEqual(canonicalHash({ x: 1 }), canonicalHash({ x: 2 }));
});

test("canonicalHash: nested objects/arrays stable across key order", () => {
  const a = canonicalHash({ a: [1, { p: 1, q: 2 }], b: "z" });
  const b = canonicalHash({ b: "z", a: [1, { q: 2, p: 1 }] });
  assert.equal(a, b);
});

test("canonicalHash: array order is significant", () => {
  assert.notEqual(canonicalHash([1, 2]), canonicalHash([2, 1]));
});

test("canonicalHash: returns 64-char sha256 hex", () => {
  assert.match(canonicalHash({ a: 1 }), /^[0-9a-f]{64}$/);
});

test("extractLastDecisionHash: returns decisionHash of last gate_verdict line", () => {
  const text = [
    JSON.stringify({ type: "gate_verdict", decisionHash: "aaa", line_hash: "1" }),
    JSON.stringify({ type: "command_end", line_hash: "2" }),
    JSON.stringify({ type: "gate_verdict", decisionHash: "bbb", line_hash: "3" })
  ].join("\n");
  assert.equal(extractLastDecisionHash(text), "bbb");
});

test("extractLastDecisionHash: null when no gate_verdict carries a hash", () => {
  const text = [
    JSON.stringify({ type: "command_start", line_hash: "1" }),
    JSON.stringify({ type: "gate_verdict", verdict: "PASS", line_hash: "2" })
  ].join("\n");
  assert.equal(extractLastDecisionHash(text), null);
});

test("extractLastDecisionHash: null on empty text", () => {
  assert.equal(extractLastDecisionHash(""), null);
});
