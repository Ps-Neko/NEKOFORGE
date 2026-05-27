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

export interface RunTrialOptions {
  filterGroup?: string;
  /** 미지정 시 DEFAULT_BENCHMARK_RULES. 채용분 포함 baseline 을 호출자가 주입. */
  activeBaseline?: readonly DeterministicRule[];
}

/**
 * 동일 fixture 로 baseline(현 카탈로그) vs candidate(현 + 후보 rule) 두 번 시험 후 비교.
 * candidate rule 은 호출자가 구성(P1b 에서 파일 로딩/해시 봉인 추가).
 * baseline 은 기본 카탈로그(DEFAULT) 이지만, opts.activeBaseline 으로 채용분 포함 룰셋을 주입할 수 있다.
 */
export async function runTrial(
  fixturesRoot: string,
  candidateRules: readonly DeterministicRule[],
  opts: RunTrialOptions = {}
): Promise<TrialResult> {
  const base = opts.activeBaseline ?? DEFAULT_BENCHMARK_RULES;
  const baseline = await runBenchmarkWithRules(fixturesRoot, base, opts.filterGroup);
  const candidate = await runBenchmarkWithRules(
    fixturesRoot,
    [...base, ...candidateRules],
    opts.filterGroup
  );
  return { baseline, candidate, decision: comparePromotion(baseline, candidate) };
}
