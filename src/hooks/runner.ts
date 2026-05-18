/**
 * Hook 실행기 + command 화이트리스트.
 *
 * 화이트리스트 규칙 (SECURITY.md §3.6 의 hook-injection-risk 와 짝):
 * - `internal:<name>` 형태는 본 모듈 내장 명령 허용 목록.
 * - 외부 명령은 첫 토큰이 ALLOWED_EXTERNAL 에 포함되어야 한다.
 * - 따옴표·세미콜론·파이프·리다이렉트가 들어있으면 거부.
 */
import type { Hook, HookContext, HookResult } from "./types.js";

const ALLOWED_INTERNAL = new Set([
  "internal:noop",
  "internal:summarizeDiff",
  "internal:recordWorklog"
]);

const ALLOWED_EXTERNAL = new Set([
  "npm",
  "npx",
  "node",
  "tsc",
  "git",
  "pnpm",
  "yarn",
  "deno",
  "bun"
]);

const SHELL_META_RE = /[;&|`$<>]|\$\(/;

export function isAllowedCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  if (trimmed.length === 0) return false;
  if (SHELL_META_RE.test(trimmed)) return false;
  if (trimmed.startsWith("internal:")) {
    return ALLOWED_INTERNAL.has(trimmed.split(/\s+/)[0] ?? "");
  }
  const first = trimmed.split(/\s+/)[0] ?? "";
  return ALLOWED_EXTERNAL.has(first);
}

export type HookExecutor = (
  hook: Hook,
  ctx: HookContext
) => Promise<HookResult>;

export const defaultExecutor: HookExecutor = async (hook, _ctx) => {
  // M2 단계의 기본 실행기는 noop 시뮬레이션. 실제 외부 명령 실행은 work 단계에서 도입.
  if (hook.command === "internal:noop") {
    return { hookId: hook.id, type: hook.type, status: "ok", exitCode: 0 };
  }
  return {
    hookId: hook.id,
    type: hook.type,
    status: "skipped",
    reason: "executor stub (M2): only internal:noop is materialized"
  };
};

export interface RunHooksOptions {
  executor?: HookExecutor;
  filterType?: Hook["type"];
}

export async function runHooks(
  hooks: readonly Hook[],
  ctx: HookContext,
  opts: RunHooksOptions = {}
): Promise<HookResult[]> {
  const exec = opts.executor ?? defaultExecutor;
  const filtered = opts.filterType
    ? hooks.filter((h) => h.type === opts.filterType)
    : hooks;
  const results: HookResult[] = [];
  for (const h of filtered) {
    if (!isAllowedCommand(h.command)) {
      const r: HookResult = {
        hookId: h.id,
        type: h.type,
        status: "failed",
        reason: `command not allowed by whitelist: ${h.command}`
      };
      results.push(r);
      if (h.blocking) return results;
      continue;
    }
    const r = await exec(h, ctx);
    results.push(r);
    if (h.blocking && r.status === "failed") return results;
  }
  return results;
}
