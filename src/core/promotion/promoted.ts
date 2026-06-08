import { DEFAULT_BENCHMARK_RULES } from "../../benchmark/index.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { PromotedManifest } from "./store-types.js";
import { loadCandidateRule, type ModuleImporter } from "./candidate.js";

export type ManifestReader = () => Promise<PromotedManifest | null>;

/** promoted.json 의 각 항목을 dynamic import 해 DeterministicRule[] 로.
 *
 * 개별 모듈 로드에 실패해도 게이트 전체가 크래시하지 않는다(graceful degradation).
 * 실패한 항목은 경고를 출력하고 건너뛰며, 나머지 유효한 룰은 정상 반환된다.
 */
export async function loadPromotedRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter,
  root?: string
): Promise<DeterministicRule[]> {
  const manifest = await readManifest();
  if (!manifest) return [];
  const out: DeterministicRule[] = [];
  for (const entry of manifest.rules) {
    try {
      out.push(
        await loadCandidateRule(
          { id: entry.id, kind: "rule", modulePath: entry.modulePath, exportName: entry.exportName, submittedAt: entry.promotedAt },
          importer,
          root
        )
      );
    } catch (err) {
      // 개별 모듈 로드 실패 — 해당 항목만 건너뛰고 나머지 룰은 계속 로드한다.
      // 게이트가 verdict 없이 크래시하는 것보다 일부 룰 없이 계속하는 게 낫다.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[loadPromotedRules] skipping promoted rule "${entry.id}" (${entry.modulePath}): ${msg}`);
    }
  }
  return out;
}

/** 현 활성 룰셋 = 기본 카탈로그 + 채용분(promoted). benchmark/gate/trial baseline 의 단일 소스. */
export async function loadActiveRules(
  readManifest: ManifestReader,
  importer?: ModuleImporter,
  root?: string
): Promise<readonly DeterministicRule[]> {
  const promoted = await loadPromotedRules(readManifest, importer, root);
  return [...DEFAULT_BENCHMARK_RULES, ...promoted];
}
