import type { FsArtifact } from "../artifact/fs-artifact.js";
import type { SkillPackDef } from "./catalog.js";

export interface PromotedSkillPackEntry extends SkillPackDef {
  promotedAt: string;
  approvalHash: string;
  experiences?: string[];
}

export interface PromotedSkillPacksManifest {
  packs: PromotedSkillPackEntry[];
}

const MANIFEST = "promoted-skill-packs.json";

export async function readPromotedSkillPacks(artifact: FsArtifact): Promise<PromotedSkillPacksManifest> {
  return (await artifact.readJson<PromotedSkillPacksManifest>(MANIFEST)) ?? { packs: [] };
}

export async function writePromotedSkillPacks(
  artifact: FsArtifact,
  manifest: PromotedSkillPacksManifest
): Promise<void> {
  await artifact.writeJson(MANIFEST, manifest);
}

export async function loadPromotedSkillPackIds(artifact: FsArtifact): Promise<Set<string>> {
  const m = await readPromotedSkillPacks(artifact);
  return new Set(m.packs.map((p) => p.id));
}
