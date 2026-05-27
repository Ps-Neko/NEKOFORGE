import { DEFAULT_BENCHMARK_RULES } from "../../benchmark/index.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { PromotedManifest } from "./store-types.js";
import { loadCandidateRule, type ModuleImporter } from "./candidate.js";

export type ManifestReader = () => Promise<PromotedManifest | null>;

/** promoted.json 의 각 항목을 dynamic import 해 DeterministicRule[] 로. */
export async function loadPromotedRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter
): Promise<DeterministicRule[]> {
  const manifest = await readManifest();
  if (!manifest) return [];
  const out: DeterministicRule[] = [];
  for (const entry of manifest.rules) {
    out.push(
      await loadCandidateRule(
        { id: entry.id, kind: "rule", modulePath: entry.modulePath, exportName: entry.exportName, submittedAt: entry.promotedAt },
        importer
      )
    );
  }
  return out;
}

/** 현 활성 룰셋 = 기본 카탈로그 + 채용분(promoted). benchmark/gate/trial baseline 의 단일 소스. */
export async function loadActiveRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter
): Promise<readonly DeterministicRule[]> {
  const promoted = await loadPromotedRules(readManifest, importer);
  return [...DEFAULT_BENCHMARK_RULES, ...promoted];
}
