import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readGitDiff } from "../../../src/utils/git.js";

function git(args: readonly string[], cwd: string): void {
  const r = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
}

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "nekoforge-git-test-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* Windows .git readonly cleanup is best-effort */
  }
}

test("readGitDiff: 새로 생성된(untracked) 파일도 diff 에 포함한다", () => {
  const dir = initRepo();
  try {
    writeFileSync(join(dir, "a.txt"), "1\n");
    git(["add", "a.txt"], dir);
    git(["commit", "-qm", "init"], dir);

    // 추적 중인 파일 수정 + 새 파일 생성(untracked)
    writeFileSync(join(dir, "a.txt"), "1\n2\n");
    writeFileSync(join(dir, "b.txt"), "brand new line\n");

    const d = readGitDiff(dir);
    assert.ok(d !== null, "diff 는 null 이 아니어야 한다");
    // 기존 파일 수정은 잡힌다(현재도 통과)
    assert.match(d!, /a\.txt/, "수정된 a.txt 가 diff 에 있어야 한다");
    // 새 파일은 git diff HEAD 가 누락 → 이게 RED 의 핵심
    assert.match(d!, /b\.txt/, "새로 만든 b.txt 경로가 diff 에 있어야 한다");
    assert.match(d!, /brand new line/, "새 파일 b.txt 의 내용이 diff 에 있어야 한다");
  } finally {
    cleanup(dir);
  }
});

test("readGitDiff: git 저장소가 아니면 null", () => {
  const dir = mkdtempSync(join(tmpdir(), "nekoforge-nogit-"));
  try {
    assert.equal(readGitDiff(dir), null);
  } finally {
    cleanup(dir);
  }
});

test("readGitDiff: 변경이 없으면 빈 문자열", () => {
  const dir = initRepo();
  try {
    writeFileSync(join(dir, "a.txt"), "1\n");
    git(["add", "a.txt"], dir);
    git(["commit", "-qm", "init"], dir);

    const d = readGitDiff(dir);
    assert.equal(d, "");
  } finally {
    cleanup(dir);
  }
});
