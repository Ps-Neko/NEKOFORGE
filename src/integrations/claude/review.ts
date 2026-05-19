/**
 * Claude CLI 또는 API 어댑터 (Phase D).
 *
 * 시스템에 `claude` 실행 파일이 있으면 활성화. 그렇지 않으면 환경변수
 * ANTHROPIC_API_KEY 가 설정된 경우 placeholder 로만 사용 가능을 표시.
 * 실제 HTTP 호출은 Phase D 단계에서는 stub 로 두고, Phase E 이후 확장.
 *
 * codex/real.ts 와 동일한 SpawnLike 추상화 사용.
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type {
  ReviewAdapter,
  ReviewInput,
  ReviewResult,
  ReviewFinding
} from "../review-adapter.js";
import { maskSecrets } from "../../utils/mask.js";

export interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  signal?: string | null;
  timedOut?: boolean;
}

export interface SpawnOptions {
  input?: string;
  encoding?: "utf8";
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => SpawnResult;

export interface ClaudeReviewOptions {
  command?: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  spawn?: SpawnLike;
  requireApiKey?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function defaultSpawn(
  command: string,
  args: readonly string[],
  options: SpawnOptions
): SpawnResult {
  const r = nodeSpawnSync(command, [...args], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.env ? { env: options.env } : {})
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    signal: r.signal,
    timedOut: r.signal === "SIGTERM" || r.status === null
  };
}

function normalize(out: SpawnResult, adapterId: string): ReviewResult {
  if (out.timedOut === true) {
    return {
      adapterId,
      status: "failed",
      findings: [
        {
          severity: "high",
          title: `${adapterId} adapter timed out`,
          detail: maskSecrets((out.stderr || out.stdout || "").slice(0, 500))
        }
      ],
      summary: "timeout"
    };
  }
  if (out.status !== 0) {
    return {
      adapterId,
      status: "failed",
      findings: [
        {
          severity: "high",
          title: `${adapterId} adapter non-zero exit`,
          detail: maskSecrets((out.stderr || out.stdout || "").slice(0, 500))
        }
      ],
      summary: `exit=${out.status}`
    };
  }
  try {
    const parsed = JSON.parse(out.stdout) as {
      status?: ReviewResult["status"];
      findings?: ReviewFinding[];
      summary?: string;
    };
    return {
      adapterId,
      status: parsed.status ?? "passed",
      findings: parsed.findings ?? [],
      summary: parsed.summary ?? ""
    };
  } catch {
    return {
      adapterId,
      status: "warnings",
      findings: [
        {
          severity: "warning",
          title: `${adapterId} adapter output not JSON`,
          detail: maskSecrets(out.stdout.slice(0, 500))
        }
      ],
      summary: "unparsed output captured as warning"
    };
  }
}

export function createClaudeReviewAdapter(
  opts: ClaudeReviewOptions = {}
): ReviewAdapter {
  const command = opts.command ?? "claude";
  const args = opts.args ?? ["review", "--stdin"];
  const spawn = opts.spawn ?? defaultSpawn;
  return {
    id: "claude",
    async available() {
      try {
        const probe = spawn(command, ["--version"], {});
        if (probe.status === 0) return true;
        if (opts.requireApiKey && process.env.ANTHROPIC_API_KEY) return true;
        return false;
      } catch {
        return opts.requireApiKey === true &&
          !!process.env.ANTHROPIC_API_KEY;
      }
    },
    async run(input: ReviewInput): Promise<ReviewResult> {
      const r = spawn(command, args, {
        input: input.rawDiff,
        encoding: "utf8",
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        ...(opts.env ? { env: opts.env } : {})
      });
      return normalize(r, "claude");
    }
  };
}
