import { test } from "node:test";
import assert from "node:assert/strict";
import { appendLedgerLine, verifyLedgerChain } from "../../../src/core/promotion/ledger.js";

test("appendLedgerLine: 첫 줄 prev_hash=null, line_hash 존재", () => {
  const { line, entry } = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  assert.equal(entry.prev_hash, null);
  assert.ok(entry.line_hash.length === 64);
  assert.ok(line.endsWith("\n"));
});

test("appendLedgerLine: 둘째 줄 prev_hash = 첫 줄 line_hash (chain)", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", verdict: "approved", at: "t1" });
  assert.equal(b.entry.prev_hash, a.entry.line_hash);
});

test("verifyLedgerChain: 정상 chain → valid", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", at: "t1" });
  assert.equal(verifyLedgerChain(a.line + b.line).valid, true);
});

test("verifyLedgerChain: 본문 변조 → invalid", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const tampered = a.line.replace('"c1"', '"c2"');
  assert.equal(verifyLedgerChain(tampered).valid, false);
});
