/**
 * gate verdict 캡 — score/rulePack/worker cap 병합 + triggered pack 역매핑.
 *
 * gate/index.ts 에서 분리(Step 1 모듈화). 낮은 VERDICT_ORDER 가 더 엄격.
 */
import type { RuleFinding } from "../../rules/index.js";
import type { Verdict } from "./verdict.js";
import { RULE_PACK_CATALOG } from "../../rule-packs/catalog.js";

const VERDICT_ORDER: Record<Verdict, number> = {
  PASS: 5,
  PASS_WITH_WARNINGS: 4,
  NEEDS_HUMAN_REVIEW: 3,
  BLOCK: 2,
  INSUFFICIENT_EVIDENCE: 1
};

/**
 * 두 verdict 중 더 보수적인 것을 채택 (낮은 order 가 더 엄격).
 */
export function applyScoreCap(
  base: { verdict: Verdict; riskLevel: "low" | "medium" | "high" | "critical"; humanApprovalRequired: boolean; reasons: string[] },
  cap: Verdict | null
): typeof base {
  if (!cap) return base;
  if (VERDICT_ORDER[cap] >= VERDICT_ORDER[base.verdict]) return base;
  return {
    verdict: cap,
    riskLevel: cap === "BLOCK" || cap === "INSUFFICIENT_EVIDENCE" ? "critical" : "high",
    humanApprovalRequired: true,
    reasons: [...base.reasons, `quality score cap: ${cap}`]
  };
}

/**
 * Phase WF/RP — 여러 cap (scoreCap, rulePackCap, workerCap) 중 가장 엄격한 것을 채택.
 * 낮은 VERDICT_ORDER 가 더 엄격.
 */
export function mergeCap(a: Verdict | null, b: Verdict | null): Verdict | null {
  if (!a) return b;
  if (!b) return a;
  return VERDICT_ORDER[a] <= VERDICT_ORDER[b] ? a : b;
}

// worker-safety-core 는 catalog 의 결정적 '룰' 정의가 아니라 worker 합성 단계
// (phase-synthesis)가 내는 finding id 로 트리거된다 — 이 id 들은 결정적 rule 이 아니라
// catalog.rules 에 없다. 그래서 이 pack 만 reverse-map 트리거 대상을 명시 오버라이드한다
// (드리프트가 아니라 의미 차이: catalog=룰 정의 / 여기=어떤 finding 이 pack 을 트리거하나).
const TRIGGER_ID_OVERRIDE: Readonly<Record<string, readonly string[]>> = {
  "worker-safety-core": [
    "worker-safety-risk",
    "worker-role-separation",
    "worker-missing-required",
    "worker-critical-finding",
    "worker-high-finding",
    "worker-factory-missing"
  ]
};

const CATALOG_RULES_BY_PACK = new Map(RULE_PACK_CATALOG.map((p) => [p.id, p.rules]));

/**
 * Phase RP — passTwo findings 의 ruleId 를 enabled pack 으로 역매핑.
 * pack→rule 매핑은 RULE_PACK_CATALOG 단일 출처에서 파생(하드코딩 드리프트 제거).
 * worker-safety-core 만 worker-합성 finding id 로 트리거되므로 명시 오버라이드(위 주석).
 */
export function uniqueTriggeredPacks(
  findings: ReadonlyArray<RuleFinding>,
  enabledPacks: ReadonlyArray<string>
): string[] {
  const triggered = new Set<string>();
  const ids = new Set(findings.map((f) => f.ruleId));
  for (const p of enabledPacks) {
    const triggerIds = TRIGGER_ID_OVERRIDE[p] ?? CATALOG_RULES_BY_PACK.get(p) ?? [];
    if (triggerIds.some((r) => ids.has(r))) triggered.add(p);
  }
  return [...triggered];
}
