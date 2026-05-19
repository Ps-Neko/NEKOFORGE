/**
 * Hook 실행기 + command 화이트리스트.
 *
 * 화이트리스트 규칙 (SECURITY.md §3.6 의 hook-injection-risk 와 짝):
 * - `internal:<name>` 형태는 본 모듈 내장 명령 허용 목록.
 * - 외부 명령은 첫 토큰이 ALLOWED_EXTERNAL 에 포함되어야 한다.
 * - 따옴표·세미콜론·파이프·리다이렉트가 들어있으면 거부.
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type { Hook, HookContext, HookResult } from "./types.js";
import { maskSecrets } from "../utils/mask.js";

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

/**
 * Codex re-review #1 (Major) — 외부 명령을 실제 spawn 으로 실행.
 *
 * - `internal:noop` 은 즉시 ok.
 * - 그 외 `internal:*` 는 미구현으로 skipped.
 * - 외부 명령 (npm/npx/tsc/git 등) 은 spawnSync 로 실행 (timeout 60s, shell:false).
 * - stdout/stderr 는 maskSecrets 로 마스킹 후 output 에 truncate.
 *
 * spawn 함수는 SPAWN_INJECTOR.spawn 으로 교체 가능 (테스트용).
 */
export interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  signal?: string | null;
}

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number }
) => SpawnResult;

const DEFAULT_HOOK_TIMEOUT_MS = 60_000;

export const SPAWN_INJECTOR: { spawn: SpawnLike } = {
  spawn: (command, args, options) => {
    const r = nodeSpawnSync(command, [...args], {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      timeout: options.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS,
      shell: false
    });
    return {
      status: r.status,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
      signal: r.signal
    };
  }
};

export const defaultExecutor: HookExecutor = async (hook, ctx) => {
  if (hook.command === "internal:noop") {
    return { hookId: hook.id, type: hook.type, status: "ok", exitCode: 0 };
  }
  if (hook.command.startsWith("internal:")) {
    return {
      hookId: hook.id,
      type: hook.type,
      status: "skipped",
      reason: `internal command not implemented: ${hook.command}`
    };
  }
  const tokens = hook.command.trim().split(/\s+/);
  const cmd = tokens[0]!;
  const args = tokens.slice(1);
  const r = SPAWN_INJECTOR.spawn(cmd, args, { cwd: ctx.cwd });
  const ok = r.status === 0;
  const output = maskSecrets(
    `${r.stdout ?? ""}\n${r.stderr ?? ""}`.slice(0, 1000)
  );
  return {
    hookId: hook.id,
    type: hook.type,
    status: ok ? "ok" : "failed",
    exitCode: r.status ?? -1,
    output,
    ...(ok ? {} : { reason: `exit=${r.status ?? "?"}${r.signal ? ` signal=${r.signal}` : ""}` })
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
