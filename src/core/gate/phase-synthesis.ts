/**
 * gate Phase 4-7 — quality-contract/score · worker factory · rule/skill pack
 * 평가 + 최종 verdict 합성(모든 cap 병합).
 *
 * run-helpers.ts 에서 분리. 제어 흐름·결과값·동작 변경 없음(behavior-preserving).
 */
import type { StageDeps } from "../stage-runner.js";
import type { RuleFinding } from "../../rules/index.js";
import { makeFinding } from "../../rules/types.js";
import type { Diff } from "../../utils/diff.js";
import {
  calculateQualityScore,
  verdictHintFromScore
} from "../../scoring/index.js";
import {
  readWorkers,
  profileRequiredRoles,
  type WorkerProfile
} from "../../workers/index.js";
import {
  validateRoleSeparation,
  detectForbiddenActions
} from "../../workers/validate.js";
import { collectTaskWorkerResults } from "../../workers/result.js";
import { readRulePacks } from "../../rule-packs/index.js";
import { resolveRulePacks } from "../../rule-packs/resolve.js";
import { readSkillPacks, resolveSkillPacks } from "../../skill-packs/index.js";
import { computeVerdict, type Verdict } from "./verdict.js";
import { applyScoreCap, mergeCap } from "./caps.js";
import { uniqueRuleIds } from "./rules-run.js";
import { detectUiInDiff, renderQualityScoreMd } from "./render.js";
import type { QualityContractJson } from "./evidence.js";
import type {
  GateInput,
  QualityEvalResult,
  WorkerEvalResult,
  PackEvalResult,
  VerdictResult
} from "./gate-types.js";

// ── Phase 4: quality-contract + quality-score 평가 ──────────────────────────

export async function evaluateQualityContract(
  passTwo: RuleFinding[],
  archFindings: RuleFinding[],
  designFindings: RuleFinding[],
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  evidenceMissing: boolean,
  diff: Diff,
  deps: StageDeps
): Promise<QualityEvalResult> {
  // Phase QF — quality-contract 읽기 + quality-score 계산.
  // Codex review #3 (Critical #2) — schema invalid 와 not found 구분.
  let contract: QualityContractJson | null = null;
  let contractInvalid = false;
  if (await deps.artifact.exists("quality-contract.json")) {
    try {
      contract = await deps.artifact.readJson<QualityContractJson>(
        "quality-contract.json",
        "quality-contract"
      );
    } catch {
      // schema 위반 — gate verdict 를 INSUFFICIENT_EVIDENCE 로 강등.
      contractInvalid = true;
      passTwo.push(
        makeFinding(
          "quality-contract-invalid",
          "critical",
          "quality-contract.json fails schema validation"
        )
      );
    }
  }
  let qualityScore: QualityEvalResult["qualityScore"] = null;
  let scoreCap: Verdict | null = contractInvalid ? "INSUFFICIENT_EVIDENCE" : null;
  if (contract) {
    qualityScore = calculateQualityScore({
      findings: passTwo,
      architectureFindings: archFindings,
      designFindings,
      testStatus: effectiveTestStatus,
      reviewStatus,
      evidenceComplete: !evidenceMissing,
      qualityBars: contract.qualityBars,
      taskId: contract.taskId,
      uiTouched:
        contract.riskProfile?.uiTouched === true || detectUiInDiff(diff)
    });
    const requiredFailure = qualityScore.failedQualityBars.some((s) => {
      const bar = s.split(":")[0]!;
      return contract!.qualityBars[bar]?.required === true;
    });
    const hint = verdictHintFromScore(qualityScore, requiredFailure);
    scoreCap = hint.capAt;
    await deps.artifact.writeJson(
      "quality-score.json",
      qualityScore,
      "quality-score"
    );
    await deps.artifact.writeMarkdown(
      "quality-score.md",
      renderQualityScoreMd(qualityScore, hint.reason)
    );
  }

  return { contract, contractInvalid, qualityScore, scoreCap };
}

// ── Phase 5: worker factory 평가 ────────────────────────────────────────────

export async function evaluateWorkerFactory(
  input: GateInput,
  passTwo: RuleFinding[],
  deps: StageDeps
): Promise<WorkerEvalResult> {
  const workers = await readWorkers(deps);
  const workerResults = workers
    ? await collectTaskWorkerResults(input.taskId ?? "TASK-001", deps)
    : [];
  const completedRoles = workerResults
    .filter((r) => r.status === "completed")
    .map((r) => r.role);
  const requiredRoles = workers
    ? profileRequiredRoles(workers.profile as WorkerProfile)
    : [];
  const missingWorkers = requiredRoles.filter(
    (r) => !completedRoles.includes(r)
  );
  const separationViolations = workers
    ? validateRoleSeparation(workers.workers, workers.roleSeparation)
    : [];
  const workerFindings = workerResults.flatMap((r) => r.findings ?? []);
  const criticalWorkerFindings = workerFindings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highWorkerFindings = workerFindings.filter(
    (f) => f.severity === "high"
  ).length;

  // worker-safety — body 안에 forbidden action 패턴이 있으면 critical.
  for (const wr of workerResults) {
    const resultPath = wr.evidence?.result;
    if (!resultPath) continue;
    const body =
      (await deps.artifact.readMarkdown(
        resultPath.replace(/^\.harness\//, "")
      )) ?? "";
    const hits = detectForbiddenActions(body);
    if (hits.length > 0) {
      passTwo.push(
        makeFinding(
          "worker-safety-risk",
          "critical",
          `worker ${wr.role} body contains forbidden action: ${hits.map((h) => h.rule).join(", ")}`
        )
      );
    }
  }

  let workerCap: Verdict | null = null;
  if (workers) {
    if (missingWorkers.length > 0) {
      const sec = missingWorkers.includes("security-reviewer");
      if (input.mode === "release" && sec) {
        workerCap = "INSUFFICIENT_EVIDENCE";
      } else {
        workerCap = "NEEDS_HUMAN_REVIEW";
      }
      const taskId = input.taskId ?? "TASK-001";
      const fixHints = missingWorkers
        .map(
          (w) =>
            `dispatch+import ${w}: harness dispatch ${taskId} --worker ${w} → harness worker-result import ${taskId} --worker ${w} --file <result.md>`
        )
        .join("; ");
      passTwo.push(
        makeFinding(
          "worker-missing-required",
          input.mode === "release" && sec ? "critical" : "high",
          `required worker(s) missing: ${missingWorkers.join(", ")}. Fix: ${fixHints}`
        )
      );
    }
    if (separationViolations.length > 0) {
      workerCap =
        workerCap === "INSUFFICIENT_EVIDENCE" ? workerCap : "NEEDS_HUMAN_REVIEW";
      passTwo.push(
        makeFinding(
          "worker-role-separation",
          "high",
          `role separation violation: ${separationViolations.join("; ")}`
        )
      );
    }
    if (criticalWorkerFindings > 0) {
      passTwo.push(
        makeFinding(
          "worker-critical-finding",
          "critical",
          `${criticalWorkerFindings} critical worker finding(s) reported`
        )
      );
    } else if (highWorkerFindings > 0) {
      passTwo.push(
        makeFinding(
          "worker-high-finding",
          "high",
          `${highWorkerFindings} high worker finding(s) reported`
        )
      );
    }
  } else if (input.mode === "release") {
    // release mode 인데 workers.json 없으면 INSUFFICIENT_EVIDENCE.
    workerCap = "INSUFFICIENT_EVIDENCE";
    passTwo.push(
      makeFinding(
        "worker-factory-missing",
        "critical",
        "release mode requires workers.json (run `harness workers init --profile strict`)"
      )
    );
  }

  return {
    workers,
    workerResults,
    completedRoles,
    requiredRoles,
    missingWorkers,
    separationViolations,
    workerFindings,
    criticalWorkerFindings,
    highWorkerFindings,
    workerCap
  };
}

// ── Phase 6: rule pack / skill pack 평가 ────────────────────────────────────

export async function evaluatePacks(
  input: GateInput,
  passTwo: RuleFinding[],
  contract: QualityContractJson | null,
  deps: StageDeps
): Promise<PackEvalResult> {
  const rulePacks = await readRulePacks(deps);
  const skillPacks = await readSkillPacks(deps);
  const templateName =
    contract && "template" in contract
      ? ((contract as { template?: string }).template ?? undefined)
      : undefined;
  const rulePackResolve = rulePacks
    ? resolveRulePacks({
        packs: rulePacks,
        template: templateName,
        mode: input.mode
      })
    : null;
  const skillPackResolve =
    skillPacks && templateName
      ? resolveSkillPacks(skillPacks, templateName)
      : null;

  let rulePackCap: Verdict | null = null;
  if (rulePackResolve && rulePackResolve.missingRequired.length > 0) {
    passTwo.push(
      makeFinding(
        "rule-pack-missing",
        "critical",
        `required rule pack missing: ${rulePackResolve.missingRequired.join(", ")}`
      )
    );
    rulePackCap = "INSUFFICIENT_EVIDENCE";
    // web-ui + design-web 누락은 NEEDS_HUMAN_REVIEW 수준으로 약화.
    if (
      templateName === "web-ui" &&
      rulePackResolve.missingRequired.length === 1 &&
      rulePackResolve.missingRequired[0] === "design-web"
    ) {
      rulePackCap = "NEEDS_HUMAN_REVIEW";
    }
  }

  return {
    rulePacks,
    skillPacks,
    rulePackResolve,
    skillPackResolve,
    templateName,
    rulePackCap
  };
}

// ── Phase 7: verdict 계산 ────────────────────────────────────────────────────

export function computeFinalVerdict(
  passTwo: RuleFinding[],
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient",
  reviewStatus: "passed" | "warnings" | "failed" | "not_run",
  evidenceMissing: boolean,
  scoreCap: Verdict | null,
  rulePackCap: Verdict | null,
  workerCap: Verdict | null
): VerdictResult {
  const verdictBase = computeVerdict({
    findings: passTwo,
    testStatus: effectiveTestStatus,
    reviewStatus,
    evidenceMissing,
    schemaFailed: false
  });

  const allCaps: Array<Verdict | null> = [scoreCap, rulePackCap, workerCap];
  const strictestCap = allCaps.reduce<Verdict | null>(
    (acc, cap) => mergeCap(acc, cap),
    null
  );
  const verdict = applyScoreCap(verdictBase, strictestCap);

  const triggered = uniqueRuleIds(passTwo);
  const hasSerious = passTwo.some(
    (f) => f.severity === "critical" || f.severity === "high"
  );
  const rulesStatus = hasSerious ? ("failed" as const) : ("passed" as const);

  return { verdict, triggered, hasSerious, rulesStatus };
}
