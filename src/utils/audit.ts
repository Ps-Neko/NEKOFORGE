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
  /** ⓒ gate_verdict 이벤트에 박는 decision.json canonical content hash. */
  decisionHash?: string;
  /** 4,5 — gate_verdict 가 박는 입력 diff / codex 결과 content hash(증거 추적성). */
  inputDiffHash?: string;
  codexFindingsHash?: string;
  /** 2 — 어느 엔진 버전이 verdict 를 냈는지(추적성). */
  engineVersion?: string;
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

/**
 * SECURITY.md §9 — Audit anchor.
 *
 * gate 가 매 실행마다 audit.jsonl 의 firstHash/lastHash/lineCount 를
 * `.harness/audit-anchor.json` 에 anchor 로 저장한다. 다음 gate 가
 * 이전 anchor 와 비교해 chain 의 외부 위변조(append-only 위반)를 감지한다.
 */
export interface AuditAnchor {
  schemaVersion: "0.3";
  lineCount: number;
  firstHash: string | null;
  lastHash: string | null;
  recordedAt: string;
}

export function computeAnchor(text: string, atIso?: string): AuditAnchor {
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) {
    return {
      schemaVersion: "0.3",
      lineCount: 0,
      firstHash: null,
      lastHash: null,
      recordedAt: atIso ?? isoNow()
    };
  }
  let firstHash: string | null = null;
  let lastHash: string | null = null;
  try {
    const first = JSON.parse(lines[0]!) as { line_hash?: string };
    firstHash = first.line_hash ?? null;
  } catch {
    firstHash = null;
  }
  try {
    const last = JSON.parse(lines[lines.length - 1]!) as { line_hash?: string };
    lastHash = last.line_hash ?? null;
  } catch {
    lastHash = null;
  }
  return {
    schemaVersion: "0.3",
    lineCount: lines.length,
    firstHash,
    lastHash,
    recordedAt: atIso ?? isoNow()
  };
}

export interface AnchorComparison {
  match: boolean;
  reason?: string;
}

export function compareAnchor(
  prev: AuditAnchor | null,
  current: AuditAnchor
): AnchorComparison {
  if (!prev) return { match: true };
  // prev.firstHash 가 null 이면 빈 chain 으로 계산된 anchor(첫 gate 가 gate_verdict
  // append 전에 anchor 를 쓴 경우). null → non-null 은 정상 성장이지 chain 재구성이
  // 아니므로 firstHash 비교를 건너뛴다(연속 gate 오탐 방지). lineCount 가드는 유지.
  if (prev.firstHash !== null && prev.firstHash !== current.firstHash) {
    return {
      match: false,
      reason: `firstHash changed (chain reorganized): ${prev.firstHash} → ${current.firstHash}`
    };
  }
  if (current.lineCount < prev.lineCount) {
    return {
      match: false,
      reason: `lineCount decreased: ${prev.lineCount} → ${current.lineCount}`
    };
  }
  return { match: true };
}

/**
 * 2,7 — anchor 위변조 감지(compareAnchor 보완).
 *
 * - prev.lastHash 가 현재 chain 텍스트에 없으면 chain 을 통째 재계산한 것(append-only 위반).
 * - anchor 가 없는데 chain 에 이전 gate_verdict 가 있으면 anchor 파일 삭제 의심.
 *
 * prevAnchor 또는 prior gate_verdict 가 있을 때만 발화하므로 정상 첫 실행에는 영향이 없다.
 * (로컬-first 한계: chain+anchor 를 동시에 재작성하는 공격은 외부 신뢰 앵커 없이는 못 막는다.)
 */
export function detectAnchorTampering(
  prev: AuditAnchor | null,
  currentText: string
): string | null {
  if (prev?.lastHash && !currentText.includes(prev.lastHash)) {
    return "previous anchor lastHash absent from current chain (audit chain rewritten)";
  }
  if (!prev && currentText.includes('"type":"gate_verdict"')) {
    return "audit anchor missing but prior gate_verdict exists (anchor deleted?)";
  }
  return null;
}

export async function readAuditAnchor(
  cwd: string = process.cwd()
): Promise<AuditAnchor | null> {
  const path = join(harnessRoot(cwd), "audit-anchor.json");
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as AuditAnchor;
  } catch {
    return null;
  }
}

export async function writeAuditAnchor(
  anchor: AuditAnchor,
  cwd: string = process.cwd()
): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const root = harnessRoot(cwd);
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "audit-anchor.json"),
    JSON.stringify(anchor, null, 2) + "\n",
    "utf8"
  );
}
