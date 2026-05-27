import type { SkillPackDef } from "../../skill-packs/catalog.js";

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
