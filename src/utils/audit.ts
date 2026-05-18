/**
 * SECURITY.md §9 — Audit trail.
 *
 * 모든 CLI 명령 진입/종료를 `.harness/audit.jsonl` 에 JSON Lines 로 한 줄씩 적재한다.
 * 본 모듈은 다음 두 모드를 제공한다.
 *
 * - 비동기 append: 진입 시점. await 가능하다.
 * - 동기 append: process.on("exit") 훅에서 사용 (이벤트 루프 종료 후라 await 불가).
 *
 * `.harness/` 가 존재하지 않으면(init 전 호출) 조용히 무시한다.
 */
import { stat, appendFile } from "node:fs/promises";
import { statSync, appendFileSync } from "node:fs";
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

function lineFor(event: AuditEvent): string {
  return JSON.stringify({ ...event, at: event.at ?? isoNow() }) + "\n";
}

export async function appendAuditEvent(
  event: AuditEvent,
  cwd: string = process.cwd()
): Promise<void> {
  try {
    const root = harnessRoot(cwd);
    await stat(root);
    await appendFile(join(root, "audit.jsonl"), lineFor(event), "utf8");
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
    appendFileSync(join(root, "audit.jsonl"), lineFor(event), "utf8");
  } catch {
    // 동일 — 조용히 무시
  }
}
