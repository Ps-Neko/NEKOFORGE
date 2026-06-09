/**
 * gate Phase 9 — 산출 파일 쓰기(decision/REPORT/findings) + gate_verdict audit event.
 *
 * run-helpers.ts 에서 분리. 제어 흐름·결과값·동작 변경 없음(behavior-preserving).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import type { RuleFinding } from "../../rules/index.js";
import { appendAuditEvent } from "../../utils/audit.js";
import { canonicalHash } from "../../utils/integrity.js";
import { ENGINE_VERSION } from "../../version.js";
import type { Diff } from "../../utils/diff.js";
import {
  renderReport,
  renderFactoryCellsMd,
  renderReviewMd,
  detectUiInDiff
} from "./render.js";
import type { CodexFindings, QualityContractJson } from "./evidence.js";
import type { assembleDecision } from "./phase-decision.js";

// ── Phase 9: 출력 파일 쓰기 + audit event 기록 ──────────────────────────────

export async function writeGateOutputs(
  decision: ReturnType<typeof assembleDecision>,
  verdictReasons: string[],
  archFindings: RuleFinding[],
  designFindings: RuleFinding[],
  passTwo: RuleFinding[],
  triggered: string[],
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  missing: string[],
  rawDiff: string,
  codexRaw: CodexFindings | null,
  contract: QualityContractJson | null,
  diff: Diff,
  deps: StageDeps
): Promise<void> {
  await deps.artifact.writeJson("decision.json", decision, "decision");

  // Codex review #3 (Major #4) — 별도 산출 파일 작성.
  await deps.artifact.writeJson("factory-cells.json", {
    schemaVersion: "0.5",
    cells: decision.factoryCells
  });
  await deps.artifact.writeMarkdown(
    "factory-cells.md",
    renderFactoryCellsMd(decision.factoryCells)
  );
  await deps.artifact.writeJson("architecture-findings.json", {
    schemaVersion: "0.5",
    findings: archFindings,
    summary: `${archFindings.length} architecture findings (${archFindings.filter((f) => f.severity === "critical").length} critical)`
  });
  await deps.artifact.writeMarkdown(
    "architecture-review.md",
    renderReviewMd("Architecture", archFindings)
  );
  await deps.artifact.writeJson("design-findings.json", {
    schemaVersion: "0.5",
    findings: designFindings,
    summary: `${designFindings.length} design findings (uiTouched: ${contract?.riskProfile?.uiTouched === true || detectUiInDiff(diff)})`
  });
  await deps.artifact.writeMarkdown(
    "design-review.md",
    renderReviewMd("Design", designFindings)
  );

  const report = renderReport({
    verdict: decision.verdict,
    reasons: verdictReasons,
    triggered,
    reviewStatus,
    testStatus: effectiveTestStatus,
    missingEvidence: missing,
    findings: passTwo
  });
  await writeFile(join(deps.cwd, "REPORT.md"), report, "utf8");

  await appendAuditEvent(
    {
      type: "gate_verdict",
      verdict: decision.verdict,
      reason:
        triggered.length === 0 ? "no triggered rules" : triggered.join(", "),
      decisionHash: canonicalHash(decision),
      inputDiffHash: canonicalHash(rawDiff),
      engineVersion: ENGINE_VERSION,
      ...(codexRaw ? { codexFindingsHash: canonicalHash(codexRaw) } : {})
    },
    deps.cwd
  );
}
