/**
 * Skill pack render (Phase RP) — worker prompt 에 skill guidance 주입.
 */
import { findSkillPack, type SkillPackDef } from "./catalog.js";

export function renderSkillGuidance(
  enabledPacks: ReadonlyArray<string>,
  promotedDefs: ReadonlyArray<SkillPackDef> = []
): string {
  const parts: string[] = [];
  for (const id of enabledPacks) {
    const def = findSkillPack(id) ?? promotedDefs.find((d) => d.id === id);
    if (!def) continue;
    parts.push(`## ${def.id} (${def.appliesTo})`);
    for (const g of def.guidance) parts.push(`- ${g}`);
    parts.push("");
  }
  return parts.join("\n");
}
