import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendAuditEvent,
  computeAnchor,
  compareAnchor,
  readAuditAnchor,
  writeAuditAnchor
} from "../../../src/utils/audit.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-anchor-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("computeAnchor: empty text → lineCount 0 with null hashes", () => {
  const a = computeAnchor("", "2026-05-19T00:00:00Z");
  assert.equal(a.lineCount, 0);
  assert.equal(a.firstHash, null);
});

test("computeAnchor: real chain → firstHash/lastHash from JSON line_hash", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent({ type: "command_start", command: "a" }, dir);
    await appendAuditEvent({ type: "command_end", command: "a" }, dir);
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(join(dir, ".harness", "audit.jsonl"), "utf8");
    const a = computeAnchor(text, "2026-05-19T00:00:00Z");
    assert.equal(a.lineCount, 2);
    assert.ok(typeof a.firstHash === "string");
    assert.ok(typeof a.lastHash === "string");
  });
});

test("compareAnchor: null prev → match true", () => {
  const cur = computeAnchor("", "t");
  assert.deepEqual(compareAnchor(null, cur), { match: true });
});

test("compareAnchor: firstHash change → mismatch", () => {
  const prev = { schemaVersion: "0.3" as const, lineCount: 2, firstHash: "A", lastHash: "B", recordedAt: "t" };
  const cur = { schemaVersion: "0.3" as const, lineCount: 3, firstHash: "X", lastHash: "Y", recordedAt: "t2" };
  const r = compareAnchor(prev, cur);
  assert.equal(r.match, false);
  assert.match(r.reason ?? "", /firstHash changed/);
});

test("compareAnchor: lineCount decreased → mismatch", () => {
  const prev = { schemaVersion: "0.3" as const, lineCount: 5, firstHash: "A", lastHash: "B", recordedAt: "t" };
  const cur = { schemaVersion: "0.3" as const, lineCount: 3, firstHash: "A", lastHash: "C", recordedAt: "t2" };
  const r = compareAnchor(prev, cur);
  assert.equal(r.match, false);
  assert.match(r.reason ?? "", /lineCount decreased/);
});

test("compareAnchor: append-only (lineCount increased, firstHash same) → match", () => {
  const prev = { schemaVersion: "0.3" as const, lineCount: 2, firstHash: "A", lastHash: "B", recordedAt: "t" };
  const cur = { schemaVersion: "0.3" as const, lineCount: 5, firstHash: "A", lastHash: "Z", recordedAt: "t2" };
  assert.deepEqual(compareAnchor(prev, cur), { match: true });
});

test("readAuditAnchor / writeAuditAnchor: roundtrip", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    const anchor = computeAnchor("", "2026-05-19T00:00:00Z");
    await writeAuditAnchor(anchor, dir);
    const read = await readAuditAnchor(dir);
    assert.deepEqual(read, anchor);
  });
});
