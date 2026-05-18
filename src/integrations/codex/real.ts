/**
 * Codex CLI 어댑터 (Phase D).
 *
 * 시스템에 `codex` 실행 파일이 있으면 활성화. spawn 으로 호출하고
 * stdout 의 JSON 을 ReviewResult 로 정규화한다.
 * 실제 codex CLI 의 출력 스키마는 외부 도구 사양이므로, 본 어댑터는
 * 다음 두 형태를 모두 지원한다.
 *
 *   1) `{ "status": "...", "findings": [...] }` — 권장 정규화 출력.
 *   2) 자유 텍스트 — 파싱 실패 시 status="warnings", finding 1건으로 캡슐화.
 *
 * spawn 함수는 옵션으로 주입 가능 (테스트에서 가짜 spawn 사용).
 */
import { spawnSync as nodeSpawnSync } from "node:child_process";
import type {
  ReviewAdapter,
  ReviewInput,
  ReviewResult,
  ReviewFinding
} from "../review-adapter.js";

export interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: { input?: string; encoding?: "utf8"; env?: NodeJS.ProcessEnv }
) => SpawnResult;

export interface CodexRealOptions {
  command?: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  spawn?: SpawnLike;
}

function defaultSpawn(
  command: string,
  args: readonly string[],
  options: Parameters<SpawnLike>[2]
): SpawnResult {
  const r = nodeSpawnSync(command, [...args], {
    encoding: "utf8",
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.env ? { env: options.env } : {})
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? ""
  };
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalize(out: SpawnResult, adapterId: string): ReviewResult {
  if (out.status !== 0) {
    return {
      adapterId,
      status: "failed",
      findings: [
        {
          severity: "high",
          title: `${adapterId} adapter non-zero exit`,
          detail: (out.stderr || out.stdout || "").slice(0, 500)
        }
      ],
      summary: `exit=${out.status}`
    };
  }
  const parsed = tryParseJson(out.stdout) as {
    status?: ReviewResult["status"];
    findings?: ReviewFinding[];
    summary?: string;
  } | null;
  if (parsed && typeof parsed === "object") {
    return {
      adapterId,
      status: parsed.status ?? "passed",
      findings: parsed.findings ?? [],
      summary: parsed.summary ?? ""
    };
  }
  return {
    adapterId,
    status: "warnings",
    findings: [
      {
        severity: "warning",
        title: `${adapterId} adapter output not JSON`,
        detail: out.stdout.slice(0, 500)
      }
    ],
    summary: "unparsed output captured as warning"
  };
}

export function createCodexRealAdapter(
  opts: CodexRealOptions = {}
): ReviewAdapter {
  const command = opts.command ?? "codex";
  const args = opts.args ?? ["review", "--stdin"];
  const spawn = opts.spawn ?? defaultSpawn;
  return {
    id: "codex",
    async available() {
      try {
        const probe = spawn(command, ["--version"], {});
        return probe.status === 0;
      } catch {
        return false;
      }
    },
    async run(input: ReviewInput): Promise<ReviewResult> {
      const r = spawn(command, args, {
        input: input.rawDiff,
        encoding: "utf8",
        ...(opts.env ? { env: opts.env } : {})
      });
      return normalize(r, "codex");
    }
  };
}
