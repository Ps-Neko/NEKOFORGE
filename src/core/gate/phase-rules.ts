/**
 * gate Phase 3 — deterministic rule 실행 + audit chain 검증 + release benchmark.
 *
 * run-helpers.ts 에서 분리. 제어 흐름·결과값·동작 변경 없음(behavior-preserving).
 */
import type { StageDeps } from "../stage-runner.js";
import {
  ALL_ARCHITECTURE_RULES,
  ALL_DESIGN_RULES,
  ALL_API_RULES,
  ALL_DEPENDENCY_RULES,
  ALL_DOCS_RULES,
  ALL_RELEASE_EVIDENCE_RULES,
  ALL_FRONTEND_RULES,
  type RuleContext
} from "../../rules/index.js";
import { isoNow } from "../../utils/time.js";
import {
  readAuditChain,
  computeAnchor,
  compareAnchor,
  detectAnchorTampering,
  readAuditAnchor,
  writeAuditAnchor
} from "../../utils/audit.js";
import { makeFinding } from "../../rules/types.js";
import {
  runAllRules,
  runAllRulesExceptCodex,
  deriveHighRiskFlags,
  runRuleList
} from "./rules-run.js";
import type { GateInput, RulesRunResult } from "./gate-types.js";

// ── Phase 3: 규칙 실행 + audit 검증 + release benchmark ─────────────────────

export async function runRulesAndAudit(
  input: GateInput,
  baseCtx: RuleContext,
  deps: StageDeps
): Promise<RulesRunResult> {
  const passOne = await runAllRulesExceptCodex(baseCtx, deps.cwd);
  const highRiskFlags = deriveHighRiskFlags(passOne);
  const ctxWithFlags: RuleContext = { ...baseCtx, highRiskFlags };
  const passTwo = await runAllRules(ctxWithFlags, deps.cwd);

  // audit.jsonl chain 무결성 검증 (SECURITY.md §9).
  const auditChain = await readAuditChain(deps.cwd);
  if (!auditChain.valid) {
    passTwo.push(
      makeFinding(
        "audit-integrity",
        "high",
        `audit.jsonl chain broken at line ${auditChain.brokenAtLine}: ${auditChain.reason}`
      )
    );
  }
  // audit anchor 비교 — 이전 anchor 가 있으면 append-only 위반 감지.
  const prevAnchor = await readAuditAnchor(deps.cwd);
  const currentAnchor = computeAnchor(auditChain.rawText, isoNow(deps.clock));
  const anchorCmp = compareAnchor(prevAnchor, currentAnchor);
  if (!anchorCmp.match) {
    passTwo.push(
      makeFinding(
        "audit-integrity",
        "high",
        `audit anchor mismatch: ${anchorCmp.reason}`
      )
    );
  }
  // 2,7 — anchor 재작성/삭제 감지(prevAnchor 또는 prior gate_verdict 있을 때만 발화).
  const anchorTamper = detectAnchorTampering(prevAnchor, auditChain.rawText);
  if (anchorTamper) {
    passTwo.push(makeFinding("audit-integrity", "high", anchorTamper));
  }
  await writeAuditAnchor(currentAnchor, deps.cwd);

  // Codex self-audit #1 — release mode 시 benchmark smoke 필수.
  if (input.mode === "release") {
    const benchmark = await deps.artifact
      .readJson<{ totalScenarios: number; criticalRecall: number }>(
        "benchmark-results.json"
      )
      .catch(() => null);
    if (!benchmark || benchmark.totalScenarios === 0) {
      passTwo.push(
        makeFinding(
          "release-benchmark-required",
          "high",
          "release mode requires .harness/benchmark-results.json (run `harness benchmark`)"
        )
      );
    } else if (benchmark.criticalRecall < 0.8) {
      passTwo.push(
        makeFinding(
          "release-benchmark-required",
          "high",
          `release mode requires benchmark critical recall >= 0.8 (current ${benchmark.criticalRecall.toFixed(2)})`
        )
      );
    }
  }

  // Phase QF — architecture/design rule 별도 실행.
  const archFindings = await runRuleList(ALL_ARCHITECTURE_RULES, ctxWithFlags);
  const designFindings = await runRuleList(ALL_DESIGN_RULES, ctxWithFlags);
  // Phase RP-2 — api-safety / dependency-risk / docs / release-evidence /
  // frontend-accessibility rule 추가.
  passTwo.push(...(await runRuleList(ALL_API_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_DEPENDENCY_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_DOCS_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_RELEASE_EVIDENCE_RULES, ctxWithFlags)));
  passTwo.push(...(await runRuleList(ALL_FRONTEND_RULES, ctxWithFlags)));

  return { passTwo, archFindings, designFindings, ctxWithFlags };
}
