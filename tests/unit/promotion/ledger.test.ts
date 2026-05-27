import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendLedgerLine, verifyLedgerChain, computeLedgerAnchor, verifyLedgerAnchor
} from "../../../src/core/promotion/ledger.js";

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

test("computeLedgerAnchor: 빈 ledger → lineCount 0, hashes null", () => {
  const anchor = computeLedgerAnchor("", "t0");
  assert.equal(anchor.lineCount, 0);
  assert.equal(anchor.firstHash, null);
  assert.equal(anchor.lastHash, null);
});

test("computeLedgerAnchor: 2줄 → lineCount 2, first/last line_hash 포착", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", at: "t1" });
  const anchor = computeLedgerAnchor(a.line + b.line, "t2");
  assert.equal(anchor.lineCount, 2);
  assert.equal(anchor.firstHash, a.entry.line_hash);
  assert.equal(anchor.lastHash, b.entry.line_hash);
});

test("verifyLedgerAnchor: prev 없으면 ok(첫 기록)", () => {
  assert.equal(verifyLedgerAnchor(null, "").ok, true);
});

test("verifyLedgerAnchor: 정상 append(성장) → ok", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const prev = computeLedgerAnchor(a.line, "t0");
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", at: "t1" });
  assert.equal(verifyLedgerAnchor(prev, a.line + b.line).ok, true);
});

test("verifyLedgerAnchor: lineCount 감소(삭제) → not ok", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const b = appendLedgerLine(a.line, { action: "approve", id: "c1", at: "t1" });
  const prev = computeLedgerAnchor(a.line + b.line, "t2");
  assert.equal(verifyLedgerAnchor(prev, a.line).ok, false);
});

test("verifyLedgerAnchor: 전체 재작성(prev lastHash 부재) → not ok", () => {
  const a = appendLedgerLine("", { action: "submit", id: "c1", at: "t0" });
  const prev = computeLedgerAnchor(a.line, "t0");
  const rewritten = appendLedgerLine("", { action: "submit", id: "EVIL", at: "t9" });
  assert.equal(verifyLedgerAnchor(prev, rewritten.line).ok, false);
});
