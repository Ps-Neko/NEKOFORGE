/**
 * Skill pack management (Phase RP).
 */
import type { StageDeps } from "../core/stage-runner.js";
import { SKILL_PACK_CATALOG, findSkillPack } from "./catalog.js";
import { loadPromotedSkillPackIds } from "./promoted.js";

export interface SkillPacksJson {
  schemaVersion: "0.5";
  enabledPacks: string[];
  disabledPacks?: string[];
  recommendedForTemplates?: Record<string, string[]>;
}

const DEFAULT_TEMPLATE_RECOMMENDED: Record<string, string[]> = {
  "web-ui": ["typescript-quality", "web-ui-quality", "evidence-writing"],
  "backend-api": [
    "typescript-quality",
    "backend-api-quality",
    "release-readiness",
    "evidence-writing"
  ],
  "cli-tool": ["typescript-quality", "cli-tool-quality", "evidence-writing"],
  library: [
    "typescript-quality",
    "library-quality",
    "release-readiness",
    "evidence-writing"
  ]
};

const DEFAULT_ENABLED = ["typescript-quality", "evidence-writing"];

export class SkillPackError extends Error {
  readonly exitCode = 10;
  constructor(msg: string) {
    super(msg);
    this.name = "SkillPackError";
  }
}

export async function readSkillPacks(
  deps: StageDeps
): Promise<SkillPacksJson | null> {
  return deps.artifact
    .readJson<SkillPacksJson>("skill-packs.json", "skill-packs")
    .catch(() => null);
}

export async function ensureSkillPacks(
  deps: StageDeps
): Promise<SkillPacksJson> {
  const existing = await readSkillPacks(deps);
  if (existing) return existing;
  const init: SkillPacksJson = {
    schemaVersion: "0.5",
    enabledPacks: [...DEFAULT_ENABLED],
    disabledPacks: [],
    recommendedForTemplates: { ...DEFAULT_TEMPLATE_RECOMMENDED }
  };
  await deps.artifact.writeJson("skill-packs.json", init, "skill-packs");
  return init;
}

export async function enableSkillPack(
  packId: string,
  deps: StageDeps
): Promise<SkillPacksJson> {
  if (!findSkillPack(packId) && !(await loadPromotedSkillPackIds(deps.artifact)).has(packId)) {
    throw new SkillPackError(`unknown skill pack: ${packId}`);
  }
  const cur = await ensureSkillPacks(deps);
  const enabled = new Set(cur.enabledPacks);
  const disabled = new Set(cur.disabledPacks ?? []);
  enabled.add(packId);
  disabled.delete(packId);
  const next: SkillPacksJson = {
    ...cur,
    enabledPacks: [...enabled],
    disabledPacks: [...disabled]
  };
  await deps.artifact.writeJson("skill-packs.json", next, "skill-packs");
  return next;
}

export async function disableSkillPack(
  packId: string,
  deps: StageDeps
): Promise<SkillPacksJson> {
  const cur = await ensureSkillPacks(deps);
  const enabled = new Set(cur.enabledPacks);
  const disabled = new Set(cur.disabledPacks ?? []);
  enabled.delete(packId);
  disabled.add(packId);
  const next: SkillPacksJson = {
    ...cur,
    enabledPacks: [...enabled],
    disabledPacks: [...disabled]
  };
  await deps.artifact.writeJson("skill-packs.json", next, "skill-packs");
  return next;
}

export interface SkillPackStatus {
  configured: boolean;
  enabledPacks: string[];
  disabledPacks: string[];
  templateRecommendations: Record<string, string[]>;
  unknownEnabled: string[];
}

export async function getSkillPackStatus(
  deps: StageDeps
): Promise<SkillPackStatus> {
  const r = await readSkillPacks(deps);
  if (!r) {
    return {
      configured: false,
      enabledPacks: [],
      disabledPacks: [],
      templateRecommendations: { ...DEFAULT_TEMPLATE_RECOMMENDED },
      unknownEnabled: []
    };
  }
  const promotedIds = await loadPromotedSkillPackIds(deps.artifact);
  const unknown = r.enabledPacks.filter((p) => !findSkillPack(p) && !promotedIds.has(p));
  return {
    configured: true,
    enabledPacks: [...r.enabledPacks],
    disabledPacks: [...(r.disabledPacks ?? [])],
    templateRecommendations:
      r.recommendedForTemplates ?? { ...DEFAULT_TEMPLATE_RECOMMENDED },
    unknownEnabled: unknown
  };
}

export function listSkillPackCatalog(): readonly { id: string; appliesTo: string }[] {
  return SKILL_PACK_CATALOG.map((p) => ({ id: p.id, appliesTo: p.appliesTo }));
}

export interface ResolveSkillResult {
  recommended: string[];
  enabled: string[];
  missingRecommended: string[];
}

export function resolveSkillPacks(
  packs: SkillPacksJson,
  template: string | undefined
): ResolveSkillResult {
  const enabled = [...packs.enabledPacks];
  const recommended = template
    ? packs.recommendedForTemplates?.[template] ?? []
    : [];
  const missing = recommended.filter((p) => !enabled.includes(p));
  return { recommended, enabled, missingRecommended: missing };
}
