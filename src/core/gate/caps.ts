/**
 * gate verdict 캡 — score/rulePack/worker cap 병합 + triggered pack 역매핑.
 *
 * gate/index.ts 에서 분리(Step 1 모듈화). 낮은 VERDICT_ORDER 가 더 엄격.
 */
import type { RuleFinding } from "../../rules/index.js";
import type { Verdict } from "./verdict.js";

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

/**
 * Phase RP — passTwo findings 의 ruleId 를 enabled pack 으로 역매핑.
 */
export function uniqueTriggeredPacks(
  findings: ReadonlyArray<RuleFinding>,
  enabledPacks: ReadonlyArray<string>
): string[] {
  const triggered = new Set<string>();
  const ids = new Set(findings.map((f) => f.ruleId));
  for (const p of enabledPacks) {
    // 동적 import 회피 — 간단한 매칭만.
    if (p === "security-core" && [
      "secret-fallback",
      "auth-bypass",
      "dangerous-file-write",
      "hook-injection-risk",
      "agent-permission-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "test-discipline" && ["test-deletion", "no-test-risk"].some((r) => ids.has(r))) triggered.add(p);
    if (p === "architecture-core" && [
      "large-file-risk",
      "layer-violation",
      "circular-dependency-risk",
      "untyped-api-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "design-web" && [
      "accessibility-risk",
      "design-token-violation",
      "responsive-break-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "release-strict" && [
      "codex-missing-risk",
      "release-benchmark-required",
      "auto-apply-block"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "worker-safety-core" && [
      "worker-safety-risk",
      "worker-role-separation",
      "worker-missing-required",
      "worker-critical-finding",
      "worker-high-finding",
      "worker-factory-missing"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "quality-contract-core" && [
      "quality-contract-invalid",
      "rule-pack-missing"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "api-safety" && [
      "missing-input-validation-risk",
      "missing-rate-limit-risk",
      "unsafe-error-exposure-risk",
      "missing-auth-boundary-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "dependency-risk" && [
      "unbounded-version-risk",
      "new-runtime-dependency-risk",
      "postinstall-script-risk",
      "lockfile-mismatch-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "docs-quality" && [
      "stale-count-risk",
      "missing-release-note-risk",
      "missing-cli-doc-risk",
      "broken-doc-link-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "release-evidence" && [
      "release-benchmark-required",
      "missing-self-host-risk",
      "missing-migration-note-risk",
      "missing-external-review-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "frontend-accessibility" && [
      "accessibility-risk",
      "missing-focus-state-risk",
      "interactive-div-risk",
      "missing-loading-state-risk",
      "contrast-token-risk"
    ].some((r) => ids.has(r))) triggered.add(p);
    if (p === "ai-generated-code-risk" && [
      "no-test-risk",
      "untyped-api-risk",
      "secret-fallback",
      "auth-bypass"
    ].some((r) => ids.has(r))) triggered.add(p);
  }
  return [...triggered];
}
