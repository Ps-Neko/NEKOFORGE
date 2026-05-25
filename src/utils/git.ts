/**
 * git diff 호출 헬퍼. 비-git 환경 또는 git 부재 시 graceful 하게 null.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

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

export function diffHash(diffText: string): string {
  return createHash("sha256").update(diffText).digest("hex").slice(0, 16);
}
