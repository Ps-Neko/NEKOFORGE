/**
 * Phase D — review 의 어댑터 의견 불일치 정책 단위 테스트.
 *
 * 두 어댑터가 서로 다른 status 를 반환할 때, runReview 는 보수적 정책
 * (failed > warnings > passed > not_run) 으로 aggregate 하고 codex-findings.json
 * summary 에 disagreement 노트를 남긴다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReview } from "../../src/core/review/index.js";
import { buildDeps } from "../../src/core/stage-runner.js";
import type {
  ReviewAdapter,
  ReviewResult
} from "../../src/integrations/review-adapter.js";

async function inTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vh-review-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fixedAdapter(
  id: string,
  status: ReviewResult["status"]
): ReviewAdapter {
  return {
    id,
    async available() {
      return true;
    },
    async run() {
      return { adapterId: id, status, findings: [], summary: "" };
    }
  };
}

async function seedMinimalForReview(dir: string): Promise<void> {
  await mkdir(join(dir, ".harness"), { recursive: true });
  await writeFile(
    join(dir, ".harness", "worklog.md"),
    "## TASK-001 — seed\n",
    "utf8"
  );
  await writeFile(join(dir, ".harness", "last-diff.patch"), "", "utf8");
}

test("disagreement: passed + warnings → aggregate warnings, summary notes both", async () => {
  await inTmp(async (dir) => {
    await seedMinimalForReview(dir);
    const deps = buildDeps(dir);
    await runReview(
      {
        adapters: [
          fixedAdapter("a", "passed"),
          fixedAdapter("b", "warnings")
        ]
      },
      deps
    );
    const text = await readFile(
      join(dir, ".harness", "codex-findings.json"),
      "utf8"
    );
    const data = JSON.parse(text) as { status: string; summary: string };
    assert.equal(data.status, "warnings");
    assert.match(data.summary, /disagreement: a=passed, b=warnings/);
  });
});

test("disagreement: warnings + failed → failed wins", async () => {
  await inTmp(async (dir) => {
    await seedMinimalForReview(dir);
    const deps = buildDeps(dir);
    await runReview(
      {
        adapters: [
          fixedAdapter("a", "warnings"),
          fixedAdapter("b", "failed")
        ]
      },
      deps
    );
    const data = JSON.parse(
      await readFile(join(dir, ".harness", "codex-findings.json"), "utf8")
    ) as { status: string; summary: string };
    assert.equal(data.status, "failed");
    assert.match(data.summary, /disagreement: a=warnings, b=failed/);
  });
});

test("agreement: both passed → no disagreement note", async () => {
  await inTmp(async (dir) => {
    await seedMinimalForReview(dir);
    const deps = buildDeps(dir);
    await runReview(
      {
        adapters: [
          fixedAdapter("a", "passed"),
          fixedAdapter("b", "passed")
        ]
      },
      deps
    );
    const data = JSON.parse(
      await readFile(join(dir, ".harness", "codex-findings.json"), "utf8")
    ) as { status: string; summary: string };
    assert.equal(data.status, "passed");
    assert.doesNotMatch(data.summary, /disagreement/);
  });
});

test("masking: adapter receives masked rawDiff (no 24+ char tokens)", async () => {
  await inTmp(async (dir) => {
    await seedMinimalForReview(dir);
    // 24자 이상 토큰 포함 diff
    await writeFile(
      join(dir, ".harness", "last-diff.patch"),
      [
        "diff --git a/src/c.ts b/src/c.ts",
        "@@ -1 +1 @@",
        '-const k = "old";',
        '+const k = "sk-abcdefghijklmnopqrstuvwxyz0123456789";'
      ].join("\n"),
      "utf8"
    );
    let received = "";
    const deps = buildDeps(dir);
    const recorder: ReviewAdapter = {
      id: "recorder",
      async available() {
        return true;
      },
      async run(input) {
        received = input.rawDiff;
        return {
          adapterId: "recorder",
          status: "passed",
          findings: []
        };
      }
    };
    await runReview({ adapters: [recorder] }, deps);
    assert.ok(
      !received.includes("sk-abcdefghijklmnopqrstuvwxyz0123456789"),
      "adapter received unmasked secret"
    );
    assert.match(received, /sk-a\*+/);
  });
});
