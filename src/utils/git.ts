/**
 * git diff 호출 헬퍼. 비-git 환경 또는 git 부재 시 graceful 하게 null.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export function readGitDiff(cwd: string): string | null {
  try {
    const r = spawnSync("git", ["diff", "--unified=3", "HEAD"], {
      cwd,
      encoding: "utf8"
    });
    if (r.status !== 0) return null;
    return r.stdout;
  } catch {
    return null;
  }
}

export function diffHash(diffText: string): string {
  return createHash("sha256").update(diffText).digest("hex").slice(0, 16);
}
