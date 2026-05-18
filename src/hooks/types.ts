/**
 * Hook 타입 정의 — QUALITY-POLICY.md §4, ARCHITECTURE.md §6.
 */

export type HookType =
  | "pre-tool"
  | "post-tool"
  | "pre-apply"
  | "post-review"
  | "session-start"
  | "session-end";

export interface Hook {
  id: string;
  type: HookType;
  trigger?: string;
  command: string;
  blocking?: boolean;
  describe?: string;
}

export interface HookContext {
  stage: string;
  cwd: string;
  env?: Record<string, string>;
}

export interface HookResult {
  hookId: string;
  type: HookType;
  status: "skipped" | "ok" | "failed";
  exitCode?: number;
  output?: string;
  reason?: string;
}
