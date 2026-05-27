import type { FsArtifact } from "../../artifact/fs-artifact.js";
import { canonicalHash } from "../../utils/integrity.js";
import {
  appendLedgerLine, computeLedgerAnchor, verifyLedgerAnchor, type LedgerAnchor
} from "./ledger.js";
import type {
  CandidateDef, TrialRecord, PromotionDecisionRecord,
  PromotedManifest, PromotedRuleEntry, NewLedgerInput
} from "./store-types.js";

const LEDGER = "promotions/ledger.jsonl";
const LEDGER_ANCHOR = "promotions/ledger-anchor.json";
const MANIFEST = "promotions/promoted.json";

async function appendLedger(artifact: FsArtifact, input: NewLedgerInput): Promise<void> {
  const existing = (await artifact.readMarkdown(LEDGER)) ?? "";
  // §8-4: append 전 직전 anchor 로 ledger 위변조(라인 삭제/전체 재작성) 검증.
  const prevAnchor = await artifact.readJson<LedgerAnchor>(LEDGER_ANCHOR);
  const check = verifyLedgerAnchor(prevAnchor, existing);
  if (!check.ok) {
    const e = new Error(`LEDGER_TAMPERED: ${check.reason}`);
    (e as Error & { exitCode?: number }).exitCode = 5;
    throw e;
  }
  const { line } = appendLedgerLine(existing, input);
  const next = existing + line;
  // appendJsonLines 는 객체를 직렬화하므로, 이미 만든 line(개행 포함)은 writeMarkdown 으로 누적.
  await artifact.writeMarkdown(LEDGER, next);
  await artifact.writeJson(LEDGER_ANCHOR, computeLedgerAnchor(next, input.at));
}

export async function submitCandidate(artifact: FsArtifact, cand: CandidateDef): Promise<void> {
  await artifact.writeJson(`promotions/${cand.id}/candidate.json`, cand);
  await appendLedger(artifact, { action: "submit", id: cand.id, at: cand.submittedAt });
}

export async function readPromotedManifest(artifact: FsArtifact): Promise<PromotedManifest> {
  return (await artifact.readJson<PromotedManifest>(MANIFEST)) ?? { rules: [] };
}

export interface ApproveOptions { approvedBy: string; clockNow: string; }

/** §6: PROMOTE_READY 만 승인 가능. 승인 시 promoted.json 자동 등록(B안) + approvalHash 봉인 + ledger. */
export async function approveCandidate(
  artifact: FsArtifact,
  id: string,
  opts: ApproveOptions
): Promise<{ decision: PromotionDecisionRecord }> {
  const cand = await artifact.readJson<CandidateDef>(`promotions/${id}/candidate.json`);
  const trial = await artifact.readJson<TrialRecord>(`promotions/${id}/trial.json`);
  if (!cand || !trial) throw new Error(`promote approve: ${id} 후보/trial 없음 — submit/trial 먼저`);
  if (trial.verdict !== "PROMOTE_READY") {
    const e = new Error(`promote approve: ${id} verdict=${trial.verdict} — PROMOTE_READY 만 승인 가능`);
    (e as Error & { exitCode?: number }).exitCode = 3;
    throw e;
  }
  const approvalHash = canonicalHash(trial);
  const decision: PromotionDecisionRecord = {
    verdict: "approved", approvedBy: opts.approvedBy, approvalHash, decidedAt: opts.clockNow
  };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);

  const manifest = await readPromotedManifest(artifact);
  const entry: PromotedRuleEntry = {
    id: cand.id, modulePath: cand.modulePath, exportName: cand.exportName,
    promotedAt: opts.clockNow, approvalHash
  };
  if (!manifest.rules.some((r) => r.id === entry.id)) manifest.rules.push(entry);
  await artifact.writeJson(MANIFEST, manifest);

  await appendLedger(artifact, { action: "approve", id, verdict: "approved", at: opts.clockNow });
  return { decision };
}

export async function rejectCandidate(
  artifact: FsArtifact, id: string, reason: string, clockNow: string
): Promise<void> {
  const decision: PromotionDecisionRecord = { verdict: "rejected", reason, decidedAt: clockNow };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "reject", id, verdict: "rejected", at: clockNow });
}
