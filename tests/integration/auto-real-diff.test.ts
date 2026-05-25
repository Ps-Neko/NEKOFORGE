/**
 * "진짜 한 바퀴" 통합 테스트.
 *
 * 기존 e2e(auto-skeleton.test.ts)는 captureDiff 에 *손으로 박은 diff 문자열*을
 * 주입한다 — 실제 편집/캡처가 한 번도 검증되지 않았다.
 *
 * 여기서는 실제 임시 git repo 에 워커가 *진짜로 파일을 쓰고*, 실 readGitDiff 가
 * 그 변경(새 파일 포함)을 캡처해 게이트까지 흐르는지 확인한다. 이것이 자동 공장이
 * "헛바퀴"가 아니라 한 바퀴를 닫는다는 증거다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runAuto } from "../../src/core/auto/index.js";
import { readGitDiff } from "../../src/utils/git.js";
import type { WorkerAdapter } from "../../src/workers/adapter.js";

function git(args: readonly string[], cwd: string): void {
  const r = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
}

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "nekoforge-auto-real-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  writeFileSync(join(dir, "README.md"), "# fixture\n");
  git(["add", "README.md"], dir);
  git(["commit", "-qm", "init"], dir);
  return dir;
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* Windows .git readonly cleanup is best-effort */
  }
}

const passReview = {
  id: "fake-codex",
  async available() {
    return true;
  },
  async run() {
    return { adapterId: "fake-codex", status: "passed" as const, findings: [] };
  }
};

/** 실제로 repoCwd 에 파일을 쓰는 워커 — claude 가 편집하는 상황을 재현. */
function fileWritingWorker(
  repoCwd: string,
  relPath: string,
  contents: string
): WorkerAdapter & { estimateCostUsd: number } {
  return {
    id: "fake-claude",
    estimateCostUsd: 0.1,
    async available() {
      return true;
    },
    async dispatch() {
      writeFileSync(join(repoCwd, relPath), contents);
      return { status: "completed" as const, resultMd: `wrote ${relPath}` };
    }
  };
}

test("통합: 워커가 만든 새 파일이 실 readGitDiff 로 캡처되어 게이트까지 흐른다", async () => {
  const repo = initRepo();
  try {
    let captured = "";
    const r = await runAuto({
      goal: "새 모듈 추가",
      taskId: "TASK-REAL",
      maxCostUsd: 5,
      workerAdapter: fileWritingWorker(repo, "new-module.ts", "export const answer = 42;\n"),
      reviewAdapter: passReview,
      captureDiff: () => {
        captured = readGitDiff(repo) ?? "";
        return captured;
      }
    });
    // 진짜로 만들어진 새 파일이 diff 에 잡혔다 (Cycle 1 수리가 없으면 빈 diff).
    assert.match(captured, /new-module\.ts/, "새 파일 경로가 캡처돼야 한다");
    assert.match(captured, /answer = 42/, "새 파일 내용이 캡처돼야 한다");
    // 한 바퀴가 닫힌다: verdict 산출 + apply 미수행.
    assert.ok(r.verdict.length > 0, "verdict 가 나와야 한다");
    assert.equal(r.applied, false, "auto 는 절대 apply 하지 않는다");
  } finally {
    cleanup(repo);
  }
});

test("통합: 워커가 만든 새 파일에 secret-fallback 이 있으면 게이트가 BLOCK", async () => {
  const repo = initRepo();
  try {
    const r = await runAuto({
      goal: "설정 추가",
      taskId: "TASK-REAL",
      maxCostUsd: 5,
      workerAdapter: fileWritingWorker(
        repo,
        "config.ts",
        'export const KEY = process.env.API_KEY || "sk-hardcoded-fallback-123";\n'
      ),
      reviewAdapter: passReview,
      captureDiff: () => readGitDiff(repo) ?? ""
    });
    // 실제로 생성된 위험 파일이 캡처되어 게이트에서 막힌다.
    assert.equal(r.verdict, "BLOCK", "secret-fallback 은 BLOCK 이어야 한다");
    assert.equal(r.applied, false);
  } finally {
    cleanup(repo);
  }
});
