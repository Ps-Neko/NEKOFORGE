import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendAuditEvent,
  appendAuditEventSync,
  validateAuditChain,
  readAuditChain
} from "../../../src/utils/audit.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-audit-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("audit: append async to .harness/audit.jsonl when initialized", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent(
      { type: "command_start", command: "ask", argv: ["ask", "x"] },
      dir
    );
    const text = await readFile(
      join(dir, ".harness", "audit.jsonl"),
      "utf8"
    );
    assert.match(text, /"type":"command_start"/);
  });
});

test("audit: missing .harness is silently ignored (no throw)", async () => {
  await inTmp(async (dir) => {
    await appendAuditEvent({ type: "command_start", command: "ask" }, dir);
    // no .harness, no file — must not throw
    assert.ok(true);
  });
});

test("audit: sync append works inside process.on('exit')-like contexts", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    appendAuditEventSync(
      { type: "command_end", command: "ask", exitCode: 0 },
      dir
    );
    const text = await readFile(
      join(dir, ".harness", "audit.jsonl"),
      "utf8"
    );
    assert.match(text, /"type":"command_end"/);
  });
});

test("audit: each call appends one new JSON line", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent({ type: "command_start", command: "init" }, dir);
    await appendAuditEvent({ type: "gate_verdict", verdict: "PASS" }, dir);
    const text = await readFile(
      join(dir, ".harness", "audit.jsonl"),
      "utf8"
    );
    const lines = text.trim().split("\n");
    assert.equal(lines.length, 2);
    for (const l of lines) {
      const obj = JSON.parse(l);
      assert.ok(obj.at);
    }
  });
});

test("audit chain: prev_hash + line_hash on each line", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent({ type: "command_start", command: "init" }, dir);
    await appendAuditEvent({ type: "command_end", command: "init" }, dir);
    const text = await readFile(
      join(dir, ".harness", "audit.jsonl"),
      "utf8"
    );
    const lines = text.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].prev_hash, null);
    assert.ok(typeof lines[0].line_hash === "string");
    assert.equal(lines[1].prev_hash, lines[0].line_hash);
  });
});

test("validateAuditChain: well-formed chain returns valid", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent({ type: "command_start", command: "init" }, dir);
    await appendAuditEvent({ type: "command_end", command: "init" }, dir);
    const r = await readAuditChain(dir);
    assert.equal(r.valid, true);
    assert.equal(r.totalLines, 2);
  });
});

test("validateAuditChain: tampered line_hash detected", async () => {
  await inTmp(async (dir) => {
    await mkdir(join(dir, ".harness"), { recursive: true });
    await appendAuditEvent({ type: "command_start", command: "init" }, dir);
    const path = join(dir, ".harness", "audit.jsonl");
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text.trim());
    parsed.command = "TAMPERED";
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, JSON.stringify(parsed) + "\n", "utf8");
    const r = await readAuditChain(dir);
    assert.equal(r.valid, false);
    assert.equal(r.brokenAtLine, 1);
  });
});

test("validateAuditChain: prev_hash mismatch detected", async () => {
  const { createHash } = await import("node:crypto");
  const line1Payload = { type: "a", prev_hash: null };
  const line1Hash = createHash("sha256")
    .update(JSON.stringify(line1Payload))
    .digest("hex");
  const fake = [
    JSON.stringify({ ...line1Payload, line_hash: line1Hash }),
    JSON.stringify({ type: "b", prev_hash: "WRONG", line_hash: "def" })
  ].join("\n");
  const r = validateAuditChain(fake);
  assert.equal(r.valid, false);
  assert.equal(r.brokenAtLine, 2);
});

test("validateAuditChain: empty input is valid", () => {
  assert.deepEqual(validateAuditChain(""), { valid: true, totalLines: 0 });
});
