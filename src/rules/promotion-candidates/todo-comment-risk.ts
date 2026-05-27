import type { DeterministicRule } from "../types.js";
import { makeFinding } from "../types.js";

/**
 * Promotion gate self-host 시연용 후보 rule (PROMOTION-GATE.md §11).
 *
 * 추가된 코드에 TODO/FIXME 주석이 3개 이상이면 "미완성 신호" warning.
 * 단순하고 기존 카탈로그 rule 과 겹치지 않아 cross-rule 간섭이 적다.
 * 카탈로그에는 정적으로 등록하지 않는다 — promotion gate 로만 채용된다.
 */
export const todoCommentRiskRule: DeterministicRule = {
  id: "todo-comment-risk",
  describe: "추가된 코드에 TODO/FIXME 주석이 과다하면 미완성 신호",
  run: async (ctx) => {
    const added = ctx.diff.files.flatMap((f) => f.addedLines);
    const todos = added.filter((l) => /\b(TODO|FIXME)\b/.test(l));
    return todos.length >= 3
      ? [makeFinding("todo-comment-risk", "warning", `미완성 주석 ${todos.length}개`)]
      : [];
  }
};
