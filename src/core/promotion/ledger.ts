import { createHash } from "node:crypto";
import type { LedgerEntry, NewLedgerInput } from "./store-types.js";

function computeLineHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function lastLineHash(ledgerText: string): string | null {
  const lines = ledgerText.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  try {
    return (JSON.parse(lines[lines.length - 1]!) as { line_hash?: string }).line_hash ?? null;
  } catch {
    return null;
  }
}

/** 기존 ledger 텍스트에 이어 붙일 한 줄을 만든다(파일 IO 없음 — store 가 append). */
export function appendLedgerLine(
  ledgerText: string,
  input: NewLedgerInput
): { line: string; entry: LedgerEntry } {
  const prev_hash = lastLineHash(ledgerText);
  const payload = { ...input, prev_hash };
  const line_hash = computeLineHash(payload);
  const entry: LedgerEntry = { ...payload, line_hash } as LedgerEntry;
  return { line: JSON.stringify(entry) + "\n", entry };
}

export interface LedgerVerifyResult { valid: boolean; brokenAtLine?: number; reason?: string; }

/** §8-4 ledger 위변조 탐지 — audit.ts validateAuditChain 동형. */
export function verifyLedgerChain(text: string): LedgerVerifyResult {
  const lines = text.split("\n").filter((l) => l.length > 0);
  let prevHash: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
    } catch {
      return { valid: false, brokenAtLine: i + 1, reason: "invalid JSON" };
    }
    const declaredPrev = (parsed.prev_hash as string | null | undefined) ?? null;
    const declaredLine = parsed.line_hash as string | undefined;
    if (declaredLine === undefined) {
      return { valid: false, brokenAtLine: i + 1, reason: "line_hash missing" };
    }
    if (declaredPrev !== prevHash) {
      return { valid: false, brokenAtLine: i + 1, reason: "prev_hash mismatch" };
    }
    const { line_hash: _omit, ...payload } = parsed;
    if (computeLineHash(payload) !== declaredLine) {
      return { valid: false, brokenAtLine: i + 1, reason: "line_hash recomputation mismatch" };
    }
    prevHash = declaredLine;
  }
  return { valid: true };
}

export interface LedgerAnchor {
  lineCount: number;
  firstHash: string | null;
  lastHash: string | null;
  recordedAt: string;
}

/** ledger 텍스트의 외부 위변조 앵커(§8-4) — audit.ts computeAnchor 패턴 준용. */
export function computeLedgerAnchor(text: string, recordedAt: string): LedgerAnchor {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const hashOf = (l: string): string | null => {
    try {
      return (JSON.parse(l) as { line_hash?: string }).line_hash ?? null;
    } catch {
      return null;
    }
  };
  return {
    lineCount: lines.length,
    firstHash: lines.length > 0 ? hashOf(lines[0]!) : null,
    lastHash: lines.length > 0 ? hashOf(lines[lines.length - 1]!) : null,
    recordedAt
  };
}

export interface LedgerAnchorCheck { ok: boolean; reason?: string; }

/**
 * §8-4 chain+anchor 동시 위변조 방어 — 직전 anchor 대비 현 ledger 검증.
 * - lineCount 감소 → 라인 삭제(append-only 위반).
 * - firstHash 변경 → chain 재구성.
 * - prev.lastHash 가 현 텍스트에 없음 → 전체 재작성(re-chain).
 * (로컬-first 한계: chain+anchor 를 동시에 일관 재작성하는 공격은 외부 신뢰 앵커 없이는 못 막는다.)
 */
export function verifyLedgerAnchor(prev: LedgerAnchor | null, currentText: string): LedgerAnchorCheck {
  if (!prev) return { ok: true };
  const current = computeLedgerAnchor(currentText, "");
  if (current.lineCount < prev.lineCount) {
    return { ok: false, reason: `ledger lineCount 감소 ${prev.lineCount} -> ${current.lineCount} (append-only 위반)` };
  }
  if (prev.firstHash !== null && prev.firstHash !== current.firstHash) {
    return { ok: false, reason: "ledger firstHash 변경 (chain 재구성)" };
  }
  if (prev.lastHash && !currentText.includes(prev.lastHash)) {
    return { ok: false, reason: "직전 anchor 의 lastHash 가 현 ledger 에 없음 (전체 재작성)" };
  }
  return { ok: true };
}
