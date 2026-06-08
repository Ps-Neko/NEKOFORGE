import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
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

test("FsArtifact: path traversal with .. is rejected (escapes .harness/)", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    await assert.rejects(
      () => fa.writeMarkdown("../escape.md", "x"),
      /escapes \.harness/
    );
    await assert.rejects(
      () => fa.writeJson("../../evil.json", {}),
      /escapes \.harness/
    );
    await assert.rejects(
      () => fa.appendJsonLines("../sneak.jsonl", { a: 1 }),
      /escapes \.harness/
    );
  });
});

test("FsArtifact: nested relative path inside .harness/ still works", async () => {
  await inTmp(async (dir) => {
    const fa = new FsArtifact({ cwd: dir });
    await fa.writeMarkdown("pending/TASK-1.patch", "diff");
    assert.equal(await fa.readMarkdown("pending/TASK-1.patch"), "diff");
  });
});

// 심볼릭 링크/정션 탈출 차단 — `..` 문자열 검사는 통과하지만 .harness/ 안의 링크가
// 루트 밖을 가리키면 그 링크를 통해 외부에 쓰기/읽기가 일어날 수 있다. realpath 기반
// 봉쇄로 차단한다. (Windows 는 junction 으로 권한 상승 없이 디렉터리 링크 생성 가능)
test("FsArtifact: a directory link inside .harness/ escaping the root is rejected", async (t) => {
  await inTmp(async (dir) => {
    const harness = join(dir, ".harness");
    const outside = join(dir, "outside");
    await mkdir(harness, { recursive: true });
    await mkdir(outside, { recursive: true });
    try {
      await symlink(outside, join(harness, "escape"), "junction");
    } catch (err) {
      t.skip(`symlink/junction unsupported here: ${(err as Error).message}`);
      return;
    }
    const fa = new FsArtifact({ cwd: dir });
    await assert.rejects(
      () => fa.writeMarkdown("escape/evil.md", "x"),
      /escapes \.harness/
    );
    assert.equal(
      existsSync(join(outside, "evil.md")),
      false,
      "탈출 링크를 통해 외부에 파일이 써지면 안 된다"
    );
  });
});
