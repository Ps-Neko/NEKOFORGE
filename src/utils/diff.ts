/**
 * Unified diff 모델.
 *
 * 본 파일은 git diff 실행도, 디스크 IO 도 하지 않는다. 순수 함수만.
 * git 호출은 core/work 또는 cli 가 별도로 수행 후 raw 문자열을 본 parser 에 넘긴다.
 */

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  addedLines: string[];
  deletedLines: string[];
}

export interface Diff {
  files: FileChange[];
  raw?: string;
}

const DIFF_GIT_RE = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_RE = /^@@ /;

export function parseUnifiedDiff(raw: string): Diff {
  const files: FileChange[] = [];
  let current: FileChange | null = null;
  let inHunk = false;

  for (const line of raw.split(/\r?\n/)) {
    const gitMatch = line.match(DIFF_GIT_RE);
    if (gitMatch) {
      if (current) files.push(current);
      const [, oldP, newP] = gitMatch;
      current = {
        path: newP ?? oldP ?? "",
        oldPath: oldP,
        status: "modified",
        addedLines: [],
        deletedLines: []
      };
      inHunk = false;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file mode")) current.status = "added";
    else if (line.startsWith("deleted file mode")) current.status = "deleted";
    else if (line.startsWith("rename from")) current.status = "renamed";
    else if (HUNK_RE.test(line)) inHunk = true;
    else if (inHunk) {
      if (line.startsWith("+") && !line.startsWith("+++"))
        current.addedLines.push(line.slice(1));
      else if (line.startsWith("-") && !line.startsWith("---"))
        current.deletedLines.push(line.slice(1));
    }
  }
  if (current) files.push(current);
  return { files, raw };
}

export function makeFileChange(
  path: string,
  partial: Partial<Omit<FileChange, "path">> = {}
): FileChange {
  return {
    path,
    status: partial.status ?? "modified",
    addedLines: partial.addedLines ?? [],
    deletedLines: partial.deletedLines ?? [],
    ...(partial.oldPath !== undefined ? { oldPath: partial.oldPath } : {})
  };
}
