/**
 * Rule pack resolution (Phase RP) — template → required pack 매핑.
 */
import { RULE_PACK_CATALOG, findRulePack } from "./catalog.js";
import type { RulePacksJson } from "./index.js";

export interface ResolveInput {
  packs: RulePacksJson;
  template?: string;
  mode?: "fast" | "safe" | "release";
}

export interface ResolveResult {
  required: string[];
  enabled: string[];
  missingRequired: string[];
  enabledRules: string[];
}

export function resolveRulePacks(input: ResolveInput): ResolveResult {
  const enabled = [...input.packs.enabledPacks];
  const requiredSet = new Set<string>();
  const templateReq = input.template
    ? input.packs.requiredForTemplates?.[input.template] ?? []
    : [];
  for (const p of templateReq) requiredSet.add(p);
  if (input.mode === "release") requiredSet.add("release-strict");
  const required = [...requiredSet];
  const missing = required.filter((p) => !enabled.includes(p));
  const enabledRules = new Set<string>();
  for (const p of enabled) {
    const def = findRulePack(p);
    if (!def) continue;
    for (const r of def.rules) enabledRules.add(r);
  }
  return {
    required,
    enabled,
    missingRequired: missing,
    enabledRules: [...enabledRules]
  };
}

export function isRuleEnabled(
  ruleId: string,
  enabledPacks: ReadonlyArray<string>
): boolean {
  for (const p of enabledPacks) {
    const def = findRulePack(p);
    if (def?.rules.includes(ruleId)) return true;
  }
  // catalog 외 rule (audit-integrity 등 메타) 은 항상 활성.
  const inAnyPack = RULE_PACK_CATALOG.some((p) =>
    p.rules.includes(ruleId)
  );
  return !inAnyPack;
}
