/**
 * git diff 호출 헬퍼. 비-git 환경 또는 git 부재 시 graceful 하게 null.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

export function readGitDiff(cwd: string): string | null {
  try {
    const tracked = spawnSync("git", ["diff", "--unified=3", "HEAD"], {
      cwd,
      encoding: "utf8"
    });
    if (tracked.status !== 0) return null;
    let out = tracked.stdout;

    // `git diff HEAD` 는 추적 중인 파일만 본다 — 새로 생성된(untracked) 파일을
    // 빼먹는다. 코드 생성 워커는 파일을 *새로 만드는* 경우가 많으므로 누락은 치명적.
    // intent-to-add 로 잠시 인덱스에 올려 diff 에 포함시킨 뒤, 정확히 그 파일들만
    // 원복(reset)해 워킹트리/인덱스 상태를 그대로 되돌린다(부작용 0).
    const others = spawnSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd, encoding: "utf8" }
    );
    if (others.status === 0 && others.stdout.length > 0) {
      const files = others.stdout.split("\0").filter(Boolean);
      if (files.length > 0) {
        const added = spawnSync(
          "git",
          ["add", "--intent-to-add", "--", ...files],
          { cwd, encoding: "utf8" }
        );
        if (added.status === 0) {
          try {
            const withNew = spawnSync(
              "git",
              ["diff", "--unified=3", "--", ...files],
              { cwd, encoding: "utf8" }
            );
            if (withNew.status === 0) out += withNew.stdout;
          } finally {
            // intent-to-add 항목만 원복 → 다시 untracked 상태로.
            spawnSync("git", ["reset", "-q", "--", ...files], {
              cwd,
              encoding: "utf8"
            });
          }
        }
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * 워킹트리에서 변경된(staged/unstaged/untracked) 파일을 cwd 기준 상대경로로 반환.
 *
 * `git status --porcelain` 의 경로는 repo-root 기준이라 cwd 기준으로 변환하고,
 * untracked 디렉토리는 `--untracked-files=all` 로 파일 단위까지 펼친다.
 * 비-git 환경·git 부재·cwd 밖 경로는 graceful 하게 제외(빈 배열).
 */
export function readWorkingTreeChangedFiles(cwd: string): string[] {
  try {
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8"
    });
    if (top.status !== 0) return [];
    const root = top.stdout.trim();
    const res = spawnSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd, encoding: "utf8" }
    );
    if (res.status !== 0) return [];
    const out: string[] = [];
    for (const line of res.stdout.split(/\r?\n/)) {
      if (line.length < 4) continue;
      let path = line.slice(3);
      const arrow = path.indexOf(" -> ");
      if (arrow >= 0) path = path.slice(arrow + 4); // rename → 새 경로
      path = path.trim().replace(/^"(.*)"$/, "$1");
      if (!path) continue;
      const rel = relative(cwd, resolve(root, path)).replace(/\\/g, "/");
      if (rel && !rel.startsWith("../")) out.push(rel);
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

export function diffHash(diffText: string): string {
  return createHash("sha256").update(diffText).digest("hex").slice(0, 16);
}
