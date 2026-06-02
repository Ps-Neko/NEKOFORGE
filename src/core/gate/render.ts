/**
 * gate 렌더 — REPORT.md + quality-score / factory-cells / review 사이드카 md.
 *
 * gate/index.ts 에서 분리(Step 1 모듈화). 순수 포매팅 — side effect 없음.
 */
import type { RuleFinding } from "../../rules/index.js";
import type { Verdict } from "./verdict.js";
import type { QualityScoreResult } from "../../scoring/index.js";

export interface RenderInput {
  verdict: Verdict;
  reasons: string[];
  triggered: string[];
  reviewStatus: string;
  testStatus: string;
  missingEvidence: string[];
  findings: readonly RuleFinding[];
}

export function renderReport(r: RenderInput): string {
  return [
    `# REPORT`,
    "",
    `- verdict: **${r.verdict}**`,
    `- triggered rules: ${r.triggered.length > 0 ? r.triggered.join(", ") : "(none)"}`,
    `- review status: ${r.reviewStatus}`,
    `- tests: ${r.testStatus}`,
    r.missingEvidence.length > 0
      ? `- missing evidence: ${r.missingEvidence.join(", ")}`
      : "- evidence: complete",
    "",
    "## Reasons",
    ...r.reasons.map((x) => `- ${x}`),
    "",
    "## Findings",
    r.findings.length === 0
      ? "(none)"
      : r.findings
          .filter((f) => f.severity !== "info")
          .map(
            (f) =>
              `- [${f.severity}] ${f.ruleId}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}`
          )
          .join("\n")
  ].join("\n");
}

export interface FactoryCellStatusInput {
  hasIntake: boolean;
  hasSpec: boolean;
  hasPlan: boolean;
  hasDesign: boolean;
  hasPolicy: boolean;
  hasTeam: boolean;
  hasWork: boolean;
  hasReview: boolean;
}

export function computeFactoryCells(
  i: FactoryCellStatusInput
): Record<string, "complete" | "missing" | "partial"> {
  return {
    product: i.hasSpec ? "complete" : "missing",
    architecture: i.hasDesign ? "complete" : "missing",
    build: i.hasPlan && i.hasTeam && i.hasWork ? "complete" : i.hasPlan ? "partial" : "missing",
    quality: i.hasPolicy ? "complete" : "missing",
    review: i.hasReview ? "complete" : "missing",
    gate: "complete"
  };
}

export function renderQualityScoreMd(s: QualityScoreResult, hintReason: string): string {
  return [
    `# QUALITY SCORE — ${s.taskId}`,
    "",
    `Overall: **${s.scores.overall}** (threshold pass=${s.thresholds.pass}, warn=${s.thresholds.passWithWarnings})`,
    "",
    "## Scores",
    ...Object.entries(s.scores)
      .filter(([k]) => k !== "overall")
      .map(([k, v]) => `- ${k}: ${v} (weight ${s.weights[k] ?? "-"})`),
    "",
    "## Failed Quality Bars",
    s.failedQualityBars.length === 0
      ? "(none)"
      : s.failedQualityBars.map((x) => `- ${x}`).join("\n"),
    "",
    "## Reasons",
    s.reasons.length === 0 ? "(none)" : s.reasons.map((x) => `- ${x}`).join("\n"),
    "",
    `Score cap hint: ${hintReason}`
  ].join("\n");
}

// Codex review #3 (Major #3) — UI 변경 자동 감지.
const UI_PATH_RE =
  /\.(tsx|jsx|css|scss|sass|html)$|(^|\/)(components|app|pages|ui)\//i;

export function detectUiInDiff(diff: { files: Array<{ path: string }> }): boolean {
  return diff.files.some((f) => UI_PATH_RE.test(f.path));
}

export function renderFactoryCellsMd(
  cells: Record<string, "complete" | "missing" | "partial">
): string {
  return [
    "# Factory Cells",
    "",
    "| cell | status |",
    "|---|---|",
    ...Object.entries(cells).map(([k, v]) => `| ${k} | ${v} |`)
  ].join("\n");
}

export function renderReviewMd(title: string, findings: readonly RuleFinding[]): string {
  return [
    `# ${title} Review`,
    "",
    `- findings: ${findings.length}`,
    `- critical: ${findings.filter((f) => f.severity === "critical").length}`,
    `- high: ${findings.filter((f) => f.severity === "high").length}`,
    `- warning: ${findings.filter((f) => f.severity === "warning").length}`,
    "",
    "## Findings",
    findings.length === 0
      ? "(none)"
      : findings
          .map(
            (f) =>
              `- [${f.severity}] ${f.ruleId}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}`
          )
          .join("\n")
  ].join("\n");
}
