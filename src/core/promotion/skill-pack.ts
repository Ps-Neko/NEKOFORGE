import type { SkillPackDef } from "../../skill-packs/catalog.js";
import type { FsArtifact } from "../../artifact/fs-artifact.js";
import { canonicalHash } from "../../utils/integrity.js";
import { appendLedger } from "./store.js";
import {
  readPromotedSkillPacks, writePromotedSkillPacks, type PromotedSkillPackEntry
} from "../../skill-packs/promoted.js";
import type { PromotionDecisionRecord } from "./store-types.js";

export interface SkillPackCandidate extends SkillPackDef {
  submittedAt: string;
  experiences?: string[];
}

export interface SkillPackValidation {
  ok: boolean;
  reason?: string;
}

/** 후보 skill-pack JSON 구조 검증(순수). builtinIds = SKILL_PACK_CATALOG 의 id 집합. */
export function validateSkillPackCandidate(
  def: Partial<SkillPackDef>,
  builtinIds: ReadonlySet<string>
): SkillPackValidation {
  if (typeof def.id !== "string" || def.id.length === 0) return { ok: false, reason: "id 누락" };
  if (typeof def.appliesTo !== "string" || def.appliesTo.length === 0) return { ok: false, reason: "appliesTo 누락" };
  if (
    !Array.isArray(def.guidance) ||
    def.guidance.length === 0 ||
    !def.guidance.every((g) => typeof g === "string" && g.length > 0)
  ) {
    return { ok: false, reason: "guidance 는 비어있지 않은 string[] 이어야 함" };
  }
  if (builtinIds.has(def.id)) return { ok: false, reason: `id "${def.id}" 가 builtin 카탈로그와 충돌` };
  return { ok: true };
}

export async function submitSkillPack(artifact: FsArtifact, cand: SkillPackCandidate): Promise<void> {
  await artifact.writeJson(`promotions/${cand.id}/skill-pack.json`, cand);
  await appendLedger(artifact, { action: "submit", id: cand.id, at: cand.submittedAt });
}

export interface ApproveSkillPackOptions { approvedBy: string; clockNow: string; }

/** 사람 승인 → promoted-skill-packs.json 봉인 + decision + ledger. 점수화 없음(사람 게이트). */
export async function approveSkillPack(
  artifact: FsArtifact,
  id: string,
  opts: ApproveSkillPackOptions
): Promise<{ entry: PromotedSkillPackEntry }> {
  const cand = await artifact.readJson<SkillPackCandidate>(`promotions/${id}/skill-pack.json`);
  if (!cand) {
    const e = new Error(`approve-pack: ${id} 후보 없음 — submit-pack 먼저`);
    (e as Error & { exitCode?: number }).exitCode = 4;
    throw e;
  }
  const manifest = await readPromotedSkillPacks(artifact);
  if (manifest.packs.some((p) => p.id === cand.id)) {
    const e = new Error(`approve-pack: ${cand.id} 이미 채용됨`);
    (e as Error & { exitCode?: number }).exitCode = 4;
    throw e;
  }
  const approvalHash = canonicalHash(cand);
  const entry: PromotedSkillPackEntry = {
    id: cand.id, appliesTo: cand.appliesTo, guidance: cand.guidance,
    promotedAt: opts.clockNow, approvalHash,
    ...(cand.experiences && cand.experiences.length > 0 ? { experiences: cand.experiences } : {})
  };
  manifest.packs.push(entry);
  await writePromotedSkillPacks(artifact, manifest);
  const decision: PromotionDecisionRecord = {
    verdict: "approved", approvedBy: opts.approvedBy, approvalHash, decidedAt: opts.clockNow
  };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "approve", id, verdict: "approved", at: opts.clockNow });
  return { entry };
}

export async function rejectSkillPack(
  artifact: FsArtifact, id: string, reason: string, clockNow: string
): Promise<void> {
  const decision: PromotionDecisionRecord = { verdict: "rejected", reason, decidedAt: clockNow };
  await artifact.writeJson(`promotions/${id}/decision.json`, decision);
  await appendLedger(artifact, { action: "reject", id, verdict: "rejected", at: clockNow });
}
