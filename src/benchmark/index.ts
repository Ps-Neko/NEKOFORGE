/**
 * Fixture Benchmark Runner (Phase QF — QF-012).
 *
 * `fixtures/<group>/<scenario>/` 디렉터리를 스캔하며, 각 시나리오의
 * `last-diff.patch` 와 `expected.json` 을 입력으로 gate-style 평가를 수행한다.
 *
 * `expected.json` schema:
 *   { verdict: "BLOCK" | "PASS" | ..., triggeredRules: ["secret-fallback", ...] }
 *
 * 본 도구는 결정적 rule 만 사용하므로 실제 gate 의 전체 시뮬레이션 대신
 * deterministic rule 9종 + architecture/design rule 을 패치에 적용해 finding 으로 verdict 추정.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  ALL_RULES,
  ALL_ARCHITECTURE_RULES,
  ALL_DESIGN_RULES,
  type RuleFinding
} from "../rules/index.js";
import { parseUnifiedDiff } from "../utils/diff.js";

export interface BenchmarkScenarioResult {
  group: string;
  scenario: string;
  expectedVerdict: string;
  expectedRules: string[];
  observedFindings: string[];
  observedVerdict: string;
  passed: boolean;
  reason: string;
}

export interface BenchmarkReport {
  totalScenarios: number;
  passed: number;
  failed: number;
  byGroup: Record<string, { passed: number; failed: number }>;
  criticalRecall: number; // 0..1
  falsePositiveRate: number; // 0..1
  results: BenchmarkScenarioResult[];
}

interface Expected {
  verdict: "PASS" | "PASS_WITH_WARNINGS" | "NEEDS_HUMAN_REVIEW" | "BLOCK" | "INSUFFICIENT_EVIDENCE";
  triggeredRules?: string[];
}

function inferVerdict(findings: RuleFinding[]): string {
  if (findings.some((f) => f.severity === "critical")) return "BLOCK";
  if (findings.some((f) => f.severity === "high")) return "NEEDS_HUMAN_REVIEW";
  if (findings.some((f) => f.severity === "warning")) return "PASS_WITH_WARNINGS";
  return "PASS";
}

async function runScenario(
  group: string,
  scenario: string,
  scenarioDir: string
): Promise<BenchmarkScenarioResult | null> {
  let diffText: string;
  let expected: Expected;
  try {
    diffText = await readFile(join(scenarioDir, "last-diff.patch"), "utf8");
    expected = JSON.parse(
      await readFile(join(scenarioDir, "expected.json"), "utf8")
    ) as Expected;
  } catch {
    return null;
  }
  const diff = parseUnifiedDiff(diffText);
  const findings: RuleFinding[] = [];
  for (const r of [...ALL_RULES, ...ALL_ARCHITECTURE_RULES, ...ALL_DESIGN_RULES]) {
    findings.push(
      ...(await r.run({ diff, highRiskFlags: {} }))
    );
  }
  const observedVerdict = inferVerdict(findings);
  const observedRules = Array.from(
    new Set(findings.filter((f) => f.severity !== "info").map((f) => f.ruleId))
  );
  const expectedRules = expected.triggeredRules ?? [];
  const verdictMatch = observedVerdict === expected.verdict;
  const ruleMatch = expectedRules.every((r) => observedRules.includes(r));
  return {
    group,
    scenario,
    expectedVerdict: expected.verdict,
    expectedRules,
    observedFindings: observedRules,
    observedVerdict,
    passed: verdictMatch && ruleMatch,
    reason: verdictMatch
      ? ruleMatch
        ? "match"
        : `expected rules not all triggered: missing ${expectedRules
            .filter((r) => !observedRules.includes(r))
            .join(", ")}`
      : `verdict mismatch: expected ${expected.verdict}, observed ${observedVerdict}`
  };
}

export async function runBenchmark(
  fixturesRoot: string,
  filterGroup?: string
): Promise<BenchmarkReport> {
  const results: BenchmarkScenarioResult[] = [];
  let groups: string[];
  try {
    groups = await readdir(fixturesRoot);
  } catch {
    return emptyReport();
  }
  for (const group of groups) {
    if (filterGroup && group !== filterGroup) continue;
    const groupDir = join(fixturesRoot, group);
    try {
      const s = await stat(groupDir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    const scenarios = await readdir(groupDir);
    for (const scenario of scenarios) {
      const r = await runScenario(group, scenario, join(groupDir, scenario));
      if (r) results.push(r);
    }
  }
  return summarize(results);
}

function summarize(results: BenchmarkScenarioResult[]): BenchmarkReport {
  const byGroup: Record<string, { passed: number; failed: number }> = {};
  for (const r of results) {
    byGroup[r.group] ??= { passed: 0, failed: 0 };
    if (r.passed) byGroup[r.group]!.passed += 1;
    else byGroup[r.group]!.failed += 1;
  }
  const passed = results.filter((r) => r.passed).length;
  // sample 지표 — 실제 fixture 충분히 쌓이기 전까지는 의미 약함.
  const expectedBlocks = results.filter(
    (r) => r.expectedVerdict === "BLOCK" || r.expectedVerdict === "NEEDS_HUMAN_REVIEW"
  );
  const detectedBlocks = expectedBlocks.filter(
    (r) => r.observedVerdict === "BLOCK" || r.observedVerdict === "NEEDS_HUMAN_REVIEW"
  );
  const criticalRecall = expectedBlocks.length === 0 ? 1 : detectedBlocks.length / expectedBlocks.length;
  const negatives = results.filter((r) => r.expectedVerdict === "PASS");
  const fpCount = negatives.filter((r) => r.observedVerdict !== "PASS").length;
  const fpRate = negatives.length === 0 ? 0 : fpCount / negatives.length;
  return {
    totalScenarios: results.length,
    passed,
    failed: results.length - passed,
    byGroup,
    criticalRecall,
    falsePositiveRate: fpRate,
    results
  };
}

function emptyReport(): BenchmarkReport {
  return {
    totalScenarios: 0,
    passed: 0,
    failed: 0,
    byGroup: {},
    criticalRecall: 1,
    falsePositiveRate: 0,
    results: []
  };
}

export function renderBenchmarkMd(r: BenchmarkReport): string {
  const groupRows = Object.entries(r.byGroup)
    .map(([g, v]) => `| ${g} | ${v.passed}/${v.passed + v.failed} |`)
    .join("\n");
  return [
    `# Benchmark Report`,
    "",
    `- total scenarios: ${r.totalScenarios}`,
    `- passed: ${r.passed}`,
    `- failed: ${r.failed}`,
    `- critical recall: ${r.criticalRecall.toFixed(3)} (sample)`,
    `- false positive rate: ${r.falsePositiveRate.toFixed(3)} (sample)`,
    "",
    "## By Group",
    "| group | passed/total |",
    "|---|---|",
    groupRows || "| (none) | — |",
    "",
    "## Details",
    ...r.results.map(
      (x) => `- [${x.passed ? "ok" : "FAIL"}] ${x.group}/${x.scenario}: ${x.reason}`
    )
  ].join("\n");
}
