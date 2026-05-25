/**
 * runAuto — 14단계 오케스트레이터 (AI work + codex review + gate 정지).
 *
 * self-host 와 동일한 stage 흐름이나 세 가지가 다르다:
 * 1. work: workerAdapter.dispatch(...) 로 AI 가 코드를 작성한 뒤 captureDiff() 로 diff 캡처.
 * 2. review: reviewAdapter 를 실제로 연결 (codex 독립 리뷰).
 * 3. STOP: gate 이후 apply 절대 호출 안 함. applied: false 고정 반환.
 *
 * 불변식: onApply 콜백은 절대 호출되지 않는다.
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../stage-runner.js";
import { runInit } from "../init.js";
import { runIntake } from "../intake/index.js";
import { runClarify } from "../clarify/index.js";
import { runContext } from "../context/index.js";
import { runSpec } from "../spec/index.js";
import { runPlan } from "../plan/index.js";
import { runDesign } from "../harness-design/index.js";
import { runPolicy } from "../quality-policy/index.js";
import { runTeam } from "../team/index.js";
import { runQualityContract } from "../quality-contract/index.js";
import { runReview } from "../review/index.js";
import { runGate } from "../gate/index.js";
import { runWorkersInit, readWorkers } from "../../workers/index.js";
import { ensureRulePacks } from "../../rule-packs/index.js";
import { ensureSkillPacks } from "../../skill-packs/index.js";
import { renderPrompt } from "../../workers/dispatch.js";
import { diffHash } from "../../utils/git.js";
import { isoNow, systemClock } from "../../utils/time.js";
import { createCostGuard } from "./cost-guard.js";
import type { WorkerAdapter } from "../../workers/adapter.js";
import type { ReviewAdapter } from "../../integrations/review-adapter.js";
import type { Verdict } from "../gate/verdict.js";

// self-host.ts 에서 그대로 복사
const DEFAULT_SPEC = {
  who: "본 도구를 사용하는 본인",
  why: "Codex review / Beta 조건 / 기능 변경 직후 자가 검증",
  problemIfMissing: "본 도구가 본 작업을 어떻게 평가하는지 확인 부재",
  coreFeatures: "intake → ... → gate 의 모든 단계 통과 확인",
  notDoing: "신규 기능 도입, 외부 어댑터 변경, 정책 변경",
  successCriteria: "verdict 가 PASS / PASS_WITH_WARNINGS / NEEDS_HUMAN_REVIEW 중 하나, 의도되지 않은 critical 0",
  failureCriteria: "BLOCK / INSUFFICIENT_EVIDENCE, 또는 audit chain 위변조 감지"
};

const DEFAULT_CONTRACT = {
  user: "self-host 운영자 + 다음 외부 검증 사이클",
  problem: "self-host 회차의 약속 발화 / 실 결함 발견을 자동 측정",
  coreValue: "본 도구가 본 작업을 자동 PASS 시키지 않는 정직성 확인"
};

export interface AutoInput {
  goal: string;
  taskId?: string;
  maxCostUsd: number;
  workerAdapter: WorkerAdapter & { estimateCostUsd?: number };
  reviewAdapter: ReviewAdapter;
  /** 실제: () => readGitDiff(cwd) ?? ""; 테스트: fake */
  captureDiff: () => string;
  /** 절대 호출되지 않음 — 테스트에서 불변식 검증용 */
  onApply?: () => void;
}

export interface AutoResult {
  verdict: Verdict;
  triggeredRules: string[];
  reportPath: string;
  workspace: string;
  applied: false;
  spentUsd: number;
}

export async function runAuto(input: AutoInput): Promise<AutoResult> {
  const taskId = input.taskId ?? "TASK-001";
  const guard = createCostGuard(input.maxCostUsd);
  const ws = await mkdtemp(join(tmpdir(), "nekoforge-auto-"));

  await runInit({ cwd: ws });
  const deps = buildDeps(ws);

  await runIntake({ goal: input.goal }, deps);
  await runClarify(deps);
  await runContext(deps);

  const specAnswers = join(ws, "spec-answers.json");
  await writeFile(specAnswers, JSON.stringify(DEFAULT_SPEC), "utf8");
  await runSpec({ answersFile: specAnswers }, deps);

  await runPlan({}, deps);
  await runDesign({ pattern: "Pipeline" }, deps);
  await runPolicy({}, deps);
  await runTeam(deps);

  const contractAnswers = join(ws, "contract-answers.json");
  await writeFile(contractAnswers, JSON.stringify(DEFAULT_CONTRACT), "utf8");
  await runQualityContract({ taskId, template: "custom", answersFile: contractAnswers }, deps);

  await runWorkersInit({ profile: "standard", force: true }, deps);
  await ensureRulePacks(deps);
  await ensureSkillPacks(deps);

  // ① work — AI 가 코드 작성 (cost-guarded)
  const workers = await readWorkers(deps);
  const spec = (await deps.artifact.readMarkdown("SPEC.md")) ?? undefined;
  const plan = (await deps.artifact.readMarkdown("PLAN.md")) ?? undefined;
  const prompt = workers
    ? renderPrompt(taskId, "implementation-worker", workers, { spec, plan })
    : `# Worker Prompt\ntask: ${taskId}\nrole: implementation-worker\n`;

  const est = input.workerAdapter.estimateCostUsd ?? 0.5;
  guard.assertCanSpend(est);
  const work = await input.workerAdapter.dispatch({
    role: "implementation-worker",
    prompt,
    taskId
  });
  guard.record(est);

  if (work.status === "failed") {
    const e = new Error(`work 단계 실패: ${work.notes ?? "adapter failed"}`) as Error & { exitCode?: number };
    e.exitCode = 6;
    throw e;
  }

  const diff = input.captureDiff();
  await deps.artifact.writeMarkdown("last-diff.patch", diff);
  await deps.artifact.writeMarkdown(`pending/${taskId}.patch`, diff);
  await deps.artifact.writeMarkdown(
    "worklog.md",
    `## ${taskId} — ${isoNow(systemClock)}\n- diff hash: ${diffHash(diff)}\n- via: auto (claude work)\n\n`
  );

  // ② review — codex 독립 리뷰 (cost-guarded)
  guard.assertCanSpend(0.2);
  await runReview({ adapters: [input.reviewAdapter] }, deps);
  guard.record(0.2);

  // ③ gate — verdict 산출 후 STOP (apply 없음)
  const r = await runGate({ taskId }, deps);

  return {
    verdict: r.verdict,
    triggeredRules: r.triggeredRules,
    reportPath: r.reportPath,
    workspace: ws,
    applied: false,
    spentUsd: guard.spent()
  };
}
