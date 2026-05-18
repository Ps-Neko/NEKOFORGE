/**
 * Codex ReviewAdapter stub. 실제 LLM 호출 없음. 결정적 더미.
 *
 * Phase D 에서 실제 Codex CLI 또는 API 호출로 교체.
 */
import type {
  ReviewAdapter,
  ReviewInput,
  ReviewResult
} from "../review-adapter.js";

export interface CodexStubOptions {
  enabled?: boolean;
  forceStatus?: ReviewResult["status"];
}

export function createCodexStubAdapter(
  opts: CodexStubOptions = {}
): ReviewAdapter {
  return {
    id: "codex-stub",
    async available() {
      return opts.enabled === true;
    },
    async run(_input: ReviewInput): Promise<ReviewResult> {
      return {
        adapterId: "codex-stub",
        status: opts.forceStatus ?? "passed",
        findings: [],
        summary: "codex-stub (no real LLM call)"
      };
    }
  };
}
