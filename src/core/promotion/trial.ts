import {
  runBenchmarkWithRules,
  DEFAULT_BENCHMARK_RULES,
  type BenchmarkReport
} from "../../benchmark/index.js";
import type { DeterministicRule } from "../../rules/types.js";
import { comparePromotion } from "./decide.js";
import type { PromotionDecision } from "./types.js";

export interface TrialResult {
  baseline: BenchmarkReport;
  candidate: BenchmarkReport;
  decision: PromotionDecision;
}

/**
 * 동일 fixture 로 baseline(현 카탈로그) vs candidate(현 + 후보 rule) 두 번 시험 후 비교.
 * candidate rule 은 호출자가 구성(P1b 에서 파일 로딩/해시 봉인 추가).
 */
export async function runTrial(
  fixturesRoot: string,
  candidateRules: readonly DeterministicRule[],
  filterGroup?: string
): Promise<TrialResult> {
  const baseline = await runBenchmarkWithRules(
    fixturesRoot,
    DEFAULT_BENCHMARK_RULES,
    filterGroup
  );
  const candidate = await runBenchmarkWithRules(
    fixturesRoot,
    [...DEFAULT_BENCHMARK_RULES, ...candidateRules],
    filterGroup
  );
  return { baseline, candidate, decision: comparePromotion(baseline, candidate) };
}
