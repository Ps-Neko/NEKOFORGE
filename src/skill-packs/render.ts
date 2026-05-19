/**
 * Skill pack render (Phase RP) — worker prompt 에 skill guidance 주입.
 */
import { findSkillPack } from "./catalog.js";

export function renderSkillGuidance(
  enabledPacks: ReadonlyArray<string>
): string {
  const parts: string[] = [];
  for (const id of enabledPacks) {
    const def = findSkillPack(id);
    if (!def) continue;
    parts.push(`## ${def.id} (${def.appliesTo})`);
    for (const g of def.guidance) parts.push(`- ${g}`);
    parts.push("");
  }
  return parts.join("\n");
}
