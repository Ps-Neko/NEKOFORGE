/**
 * SECURITY.md §9 — Audit trail + chain hash 위변조 감지.
 *
 * 모든 CLI 명령 진입/종료를 `.harness/audit.jsonl` 에 JSON Lines 로 한 줄씩 적재한다.
 * 각 라인은 다음 필드를 갖는다.
 *
 *   - prev_hash : 직전 라인의 line_hash (없으면 null).
 *   - line_hash : sha256(JSON.stringify({...event, at, prev_hash})).
 *
 * gate 가 audit.jsonl 의 chain 무결성을 검증해 위반 시 finding 을 만든다.
 *
 * `.harness/` 가 존재하지 않으면(init 전 호출) 조용히 무시한다.
 */
import { stat, readFile, appendFile } from "node:fs/promises";
import {
  statSync,
  readFileSync,
  appendFileSync,
  existsSync
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { harnessRoot } from "./paths.js";
import { isoNow } from "./time.js";

export type AuditEventType =
  | "command_start"
  | "command_end"
  | "gate_verdict"
  | "apply_attempt"
  | "apply_refused";

export interface AuditEvent {
  type: AuditEventType;
  command?: string;
  argv?: string[];
  cwd?: string;
  exitCode?: number;
  verdict?: string;
  reason?: string;
  at?: string;
}

interface AuditEnvelope extends AuditEvent {
  prev_hash: string | null;
  line_hash: string;
}

function computeLineHash(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function readLastLineHashSync(root: string): string | null {
  const path = join(root, "audit.jsonl");
  if (!existsSync(path)) return null;
  try {
    const text = readFileSync(path, "utf8");
    const lines = text.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1]!) as { line_hash?: string };
    return last.line_hash ?? null;
  } catch {
    return null;
  }
}

async function readLastLineHash(root: string): Promise<string | null> {
  const path = join(root, "audit.jsonl");
  try {
    const text = await readFile(path, "utf8");
    const lines = text.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1]!) as { line_hash?: string };
    return last.line_hash ?? null;
  } catch {
    return null;
  }
}

function buildEnvelope(
  event: AuditEvent,
  prevHash: string | null
): AuditEnvelope {
  const payload = {
    ...event,
    at: event.at ?? isoNow(),
    prev_hash: prevHash
  };
  const line_hash = computeLineHash(payload);
  return { ...payload, line_hash };
}

export async function appendAuditEvent(
  event: AuditEvent,
  cwd: string = process.cwd()
): Promise<void> {
  try {
    const root = harnessRoot(cwd);
    await stat(root);
    const prevHash = await readLastLineHash(root);
    const env = buildEnvelope(event, prevHash);
    await appendFile(
      join(root, "audit.jsonl"),
      JSON.stringify(env) + "\n",
      "utf8"
    );
  } catch {
    // .harness/ 없거나 권한 문제 — 조용히 무시
  }
}

export function appendAuditEventSync(
  event: AuditEvent,
  cwd: string = process.cwd()
): void {
  try {
    const root = harnessRoot(cwd);
    statSync(root);
    const prevHash = readLastLineHashSync(root);
    const env = buildEnvelope(event, prevHash);
    appendFileSync(
      join(root, "audit.jsonl"),
      JSON.stringify(env) + "\n",
      "utf8"
    );
  } catch {
    // 동일 — 조용히 무시
  }
}

export interface AuditChainResult {
  valid: boolean;
  totalLines: number;
  brokenAtLine?: number;
  reason?: string;
}

/**
 * audit.jsonl 텍스트를 받아 chain 무결성을 검증한다.
 * 빈 입력 또는 모든 라인이 chain 필드를 갖지 않는 legacy 입력은 `valid: true` (단 totalLines 만 0).
 */
export function validateAuditChain(text: string): AuditChainResult {
  const lines = text.split("\n").filter((l) => l.length > 0);
  let prevHash: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {
        valid: false,
        totalLines: lines.length,
        brokenAtLine: i + 1,
        reason: "invalid JSON"
      };
    }
    const declaredPrev = (parsed.prev_hash as string | null | undefined) ?? null;
    const declaredLine = parsed.line_hash as string | undefined;
    if (declaredLine === undefined) {
      return {
        valid: false,
        totalLines: lines.length,
        brokenAtLine: i + 1,
        reason: "line_hash field missing"
      };
    }
    if (declaredPrev !== prevHash) {
      return {
        valid: false,
        totalLines: lines.length,
        brokenAtLine: i + 1,
        reason: `prev_hash mismatch (expected ${prevHash ?? "null"}, got ${declaredPrev ?? "null"})`
      };
    }
    const { line_hash: _omit, ...payload } = parsed;
    const recomputed = computeLineHash(payload);
    if (recomputed !== declaredLine) {
      return {
        valid: false,
        totalLines: lines.length,
        brokenAtLine: i + 1,
        reason: "line_hash recomputation mismatch"
      };
    }
    prevHash = declaredLine;
  }
  return { valid: true, totalLines: lines.length };
}

export async function readAuditChain(
  cwd: string = process.cwd()
): Promise<AuditChainResult & { rawText: string }> {
  const path = join(harnessRoot(cwd), "audit.jsonl");
  try {
    const text = await readFile(path, "utf8");
    return { ...validateAuditChain(text), rawText: text };
  } catch {
    return { valid: true, totalLines: 0, rawText: "" };
  }
}
