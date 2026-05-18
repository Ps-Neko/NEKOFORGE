import type { Diff, FileChange } from "../../../src/utils/diff.js";
import { makeFileChange } from "../../../src/utils/diff.js";
import type { RuleContext } from "../../../src/rules/types.js";

export function fc(
  path: string,
  partial: Partial<Omit<FileChange, "path">> = {}
): FileChange {
  return makeFileChange(path, partial);
}

export function diffOf(files: readonly FileChange[]): Diff {
  return { files: [...files] };
}

export function mockCtx(partial: Partial<RuleContext> = {}): RuleContext {
  return {
    diff: partial.diff ?? { files: [] },
    ...partial
  };
}
