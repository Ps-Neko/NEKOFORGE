/**
 * Claude CLI 워커 어댑터 (WF-3). `claude` 실행파일에 work 프롬프트를 stdin 으로
 * 넘겨 코드를 생성/편집하게 한다. spawn 은 주입 가능(테스트는 fake).
 * codex/real.ts 와 동일한 주입형 패턴.
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type { WorkerAdapter, WorkerAdapterInput, WorkerAdapterResult } from "../adapter.js";
import { registerWorkerAdapter } from "../adapter.js";

export interface SpawnResult { status: number | null; stdout: string; stderr: string; }
export interface SpawnOptions { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; }
export type SpawnLike = (command: string, args: readonly string[], options?: SpawnOptions) => SpawnResult;

export interface ClaudeAdapterOptions {
  command?: string;
  args?: readonly string[];
  spawn?: SpawnLike;
  timeoutMs?: number;
  estimateCostUsd?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function defaultSpawn(command: string, args: readonly string[], options: SpawnOptions = {}): SpawnResult {
  const r = nodeSpawnSync(command, [...args], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.env ? { env: options.env } : {})
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export function createClaudeWorkerAdapter(opts: ClaudeAdapterOptions = {}): WorkerAdapter & { estimateCostUsd: number } {
  const command = opts.command ?? "claude";
  const args = opts.args ?? ["-p"];
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
      const r = spawn(command, args, { input: input.prompt, timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
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
