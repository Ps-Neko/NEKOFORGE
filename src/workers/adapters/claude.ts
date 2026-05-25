/**
 * Claude CLI 워커 어댑터 (WF-3). `claude` 실행파일에 work 프롬프트를 stdin 으로
 * 넘겨 코드를 생성/편집하게 한다. spawn 은 주입 가능(테스트는 fake).
 * codex/real.ts 와 동일한 주입형 패턴.
 *
 * 실제로 파일을 *편집*하려면 두 가지가 필요하다:
 *  1. cwd        — 편집 대상(실 repo) 디렉터리. captureDiff 와 동일한 cwd 여야
 *                  diff 가 잡힌다(CLI 가 양쪽에 같은 projectCwd 주입).
 *  2. 편집 권한   — 헤드리스 `claude -p` 는 기본적으로 파일을 못 고친다.
 *                  `--permission-mode acceptEdits`(기본)로 편집/생성을 자동 수락.
 *                  permissionMode 옵션으로 bypassPermissions 등 오버라이드 가능.
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type { WorkerAdapter, WorkerAdapterInput, WorkerAdapterResult } from "../adapter.js";
import { registerWorkerAdapter } from "../adapter.js";

export interface SpawnResult { status: number | null; stdout: string; stderr: string; }
export interface SpawnOptions { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; cwd?: string; }
export type SpawnLike = (command: string, args: readonly string[], options?: SpawnOptions) => SpawnResult;

export interface ClaudeAdapterOptions {
  command?: string;
  args?: readonly string[];
  spawn?: SpawnLike;
  timeoutMs?: number;
  estimateCostUsd?: number;
  /** claude 가 파일을 편집할 디렉터리. captureDiff 와 동일해야 diff 가 잡힌다. */
  cwd?: string;
  /** 편집 권한 수위. 기본 acceptEdits(편집만 자동수락). bypassPermissions = 전권. */
  permissionMode?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_PERMISSION_MODE = "acceptEdits";

function defaultSpawn(command: string, args: readonly string[], options: SpawnOptions = {}): SpawnResult {
  const r = nodeSpawnSync(command, [...args], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.cwd ? { cwd: options.cwd } : {})
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function createClaudeWorkerAdapter(opts: ClaudeAdapterOptions = {}): WorkerAdapter & { estimateCostUsd: number } {
  const command = opts.command ?? "claude";
  const permissionMode = opts.permissionMode ?? DEFAULT_PERMISSION_MODE;
  const args = opts.args ?? ["-p", "--permission-mode", permissionMode];
  const spawn = opts.spawn ?? defaultSpawn;
  return {
    id: "claude",
    estimateCostUsd: opts.estimateCostUsd ?? 0.5,
    async available(): Promise<boolean> {
      try {
        return spawn(command, ["--version"]).status === 0;
      } catch {
        return false;
      }
    },
    async dispatch(input: WorkerAdapterInput): Promise<WorkerAdapterResult> {
      const r = spawn(command, args, {
        input: input.prompt,
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        ...(opts.cwd ? { cwd: opts.cwd } : {})
      });
      if (r.status !== 0) {
        return {
          status: "failed",
          resultMd: `# ${input.role} — claude 어댑터 실패\n\nexit=${r.status}\n${(r.stderr || r.stdout).slice(0, 500)}`,
          ...(r.status !== null ? { exitCode: r.status } : {}),
          notes: "claude non-zero exit"
        };
      }
      return {
        status: "completed",
        resultMd: `# ${input.role} — claude 결과\n\n${r.stdout.slice(0, 4000)}`,
        notes: "claude completed"
      };
    }
  };
}

// 모듈 로드 시 자동으로 registry 에 등록 — adapter.ts ↔ claude.ts 순환 방지.
registerWorkerAdapter("claude", () => createClaudeWorkerAdapter());
