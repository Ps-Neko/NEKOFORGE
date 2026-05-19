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

/**
 * self-host #6 발견 — Windows 에서 `npm`/`npx` 등은 `.cmd` 파일이며
 * spawnSync(shell:false) 가 PATHEXT 를 자동 탐색하지 않아 status=null 로 실패.
 *
 * 해결: 확장자 없는 화이트리스트 명령에 한해 Windows 면 `.cmd` 부착.
 * 이미 확장자 (.exe/.cmd/.bat/.com) 가 있으면 그대로 둔다.
 * shell:false 정책 (hook-injection-risk 와의 정합) 은 유지.
 */
const WINDOWS_CMD_COMMANDS = new Set(["npm", "npx", "yarn", "pnpm", "deno", "bun"]);

export function resolveExecutable(cmd: string, platform: string): string {
  if (platform !== "win32") return cmd;
  if (/\.(exe|cmd|bat|com)$/i.test(cmd)) return cmd;
  return WINDOWS_CMD_COMMANDS.has(cmd) ? `${cmd}.cmd` : cmd;
}

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
    const resolved = resolveExecutable(command, process.platform);
    // self-host #6 — Node.js 20+ 의 CVE-2024-27980 fix 가 .cmd/.bat 을
    // shell:false 로 실행하는 것을 EINVAL 로 차단.
    // 해결: .cmd/.bat 는 `cmd.exe /c <cmd> <args...>` 로 우회.
    //
    // 보안 안전 근거:
    //   1. isAllowedCommand 가 입력 단계에서 SHELL_META_RE 로 모든 셸 메타 차단.
    //   2. resolved 는 ALLOWED_EXTERNAL/INTERNAL 화이트리스트 통과.
    //   3. args 는 split(/\s+/) 로 분리된 토큰이라 셸 해석되는 위험 문자 없음.
    //   4. cmd.exe 의 argv 로 직접 전달 (shell:false) 되므로 DEP0190 의
    //      문자열 결합 / 비정상 escape 위험 회피.
    const isWinCmd =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(resolved);
    const finalCmd = isWinCmd ? "cmd.exe" : resolved;
    const finalArgs = isWinCmd ? ["/c", resolved, ...args] : [...args];
    const r = nodeSpawnSync(finalCmd, finalArgs, {
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
