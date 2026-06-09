/**
 * gate 위상 모듈 공유 타입 — runGate 가 단계별로 주고받는 입력/결과 구조.
 *
 * GateInput 을 gate/index.ts 에서 import 하면 순환이 생기므로 여기(leaf)에 둔다.
 * index.ts 와 phase-*.ts 가 모두 이 파일에서 가져온다.
 */
import type { Diff } from "../../utils/diff.js";
import type { RuleContext, RuleFinding } from "../../rules/index.js";
import type { Verdict, computeVerdict } from "./verdict.js";
import type {
  TeamJson,
  CodexFindings,
  QualityContractJson
} from "./evidence.js";
import type { QualityScoreResult } from "../../scoring/index.js";
import type { readWorkers } from "../../workers/index.js";
import type { collectTaskWorkerResults, WorkerResultJson } from "../../workers/result.js";
import type { readRulePacks } from "../../rule-packs/index.js";
import type { resolveRulePacks } from "../../rule-packs/resolve.js";
import type { readSkillPacks, resolveSkillPacks } from "../../skill-packs/index.js";

// GateInput 을 index.ts 에서 import 하면 순환이 생기므로 이 leaf 에 정의한다.
export interface GateInput {
  noReviewAdapter?: boolean;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  taskId?: string;
  mode?: "fast" | "safe" | "release";
}

export interface EvidenceCheckResult {
  missing: string[];
  evidenceMissing: boolean;
  cellInputs: {
    hasIntake: boolean;
    hasSpec: boolean;
    hasPlan: boolean;
    hasTasks: boolean;
    hasDesign: boolean;
    hasPolicy: boolean;
    hasTeam: boolean;
    hasWork: boolean;
    hasSelf: boolean;
    hasCodex: boolean;
    hasContract: boolean;
  };
}

export interface ArtifactReadResult {
  rawDiff: string;
  diff: Diff;
  team: TeamJson | null;
  codexRaw: CodexFindings | null;
  reviewStatus: "passed" | "warnings" | "failed" | "not_run";
  reviewCritical: number;
  adapterCount: number;
  inferredTestStatus: "passed" | "failed" | "not_run" | "insufficient" | null;
  effectiveTestStatus: "passed" | "failed" | "not_run" | "insufficient";
  baseCtx: RuleContext;
}

export interface RulesRunResult {
  passTwo: RuleFinding[];
  archFindings: RuleFinding[];
  designFindings: RuleFinding[];
  ctxWithFlags: RuleContext;
}

export interface QualityEvalResult {
  contract: QualityContractJson | null;
  contractInvalid: boolean;
  qualityScore: QualityScoreResult | null;
  scoreCap: Verdict | null;
}

export interface WorkerEvalResult {
  workers: Awaited<ReturnType<typeof readWorkers>>;
  workerResults: Awaited<ReturnType<typeof collectTaskWorkerResults>>;
  completedRoles: string[];
  requiredRoles: string[];
  missingWorkers: string[];
  separationViolations: string[];
  workerFindings: NonNullable<WorkerResultJson["findings"]>;
  criticalWorkerFindings: number;
  highWorkerFindings: number;
  workerCap: Verdict | null;
}

export interface PackEvalResult {
  rulePacks: Awaited<ReturnType<typeof readRulePacks>>;
  skillPacks: Awaited<ReturnType<typeof readSkillPacks>>;
  rulePackResolve: ReturnType<typeof resolveRulePacks> | null;
  skillPackResolve: ReturnType<typeof resolveSkillPacks> | null;
  templateName: string | undefined;
  rulePackCap: Verdict | null;
}

export interface VerdictResult {
  verdict: ReturnType<typeof computeVerdict>;
  triggered: string[];
  hasSerious: boolean;
  rulesStatus: "passed" | "failed";
}
