import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsArtifact } from "../../../src/artifact/fs-artifact.js";
import { createValidator } from "../../../src/schemas/loader.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-fs-art-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("FsArtifact: write then read markdown roundtrip", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    await fa.writeMarkdown("SPEC.md", "# hi");
    assert.equal(await fa.readMarkdown("SPEC.md"), "# hi");
    assert.equal(await fa.exists("SPEC.md"), true);
  });
});

test("FsArtifact: missing file returns null", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    assert.equal(await fa.readMarkdown("none.md"), null);
    assert.equal(await fa.exists("none.md"), false);
  });
});

test("FsArtifact: absolute path is rejected", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    await assert.rejects(() => fa.writeMarkdown("/etc/passwd", "x"));
  });
});

test("FsArtifact: writeJson rejects schema violation", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir, validator: createValidator() });
    await assert.rejects(() =>
      fa.writeJson("decision.json", { verdict: "OK" }, "decision")
    );
  });
});

test("FsArtifact: writeJson accepts valid decision", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir, validator: createValidator() });
    await fa.writeJson(
      "decision.json",
      {
        schemaVersion: "0.5",
        project: "p",
        taskId: "T1",
        workflowStage: "gate",
        verdict: "PASS",
        riskLevel: "low",
        humanApprovalRequired: false,
        humanApproved: false,
        evidence: {},
        apply: { allowed: true }
      },
      "decision"
    );
    assert.equal(await fa.exists("decision.json"), true);
  });
});

test("FsArtifact: appendJsonLines appends each call", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    await fa.appendJsonLines("audit.jsonl", { a: 1 });
    await fa.appendJsonLines("audit.jsonl", { a: 2 });
    const text = (await fa.readMarkdown("audit.jsonl")) ?? "";
    const lines = text.trim().split("\n");
    assert.equal(lines.length, 2);
  });
});
