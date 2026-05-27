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
