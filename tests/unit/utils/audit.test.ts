import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendAuditEvent,
  appendAuditEventSync
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
