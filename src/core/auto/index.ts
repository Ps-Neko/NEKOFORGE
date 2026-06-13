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
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
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
import { resolveSkillGuidance } from "../../skill-packs/index.js";
import { diffHash } from "../../utils/git.js";
import { isoNow, systemClock } from "../../utils/time.js";
import { createCostGuard } from "./cost-guard.js";
import type { WorkerAdapter } from "../../workers/adapter.js";
import type { ReviewAdapter } from "../../integrations/review-adapter.js";
import type { Verdict } from "../gate/verdict.js";

import { DEFAULT_SPEC, DEFAULT_CONTRACT } from "./defaults.js";

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
  /** REPORT.md 본문 — 워크스페이스는 종료 시 정리되므로 내용을 결과에 담아 전달 */
  report: string;
  /** 임시 워크스페이스 경로. 정상/오류 종료 모두에서 정리됨(진단·회귀테스트용 기록) */
  workspace: string;
  applied: false;
  spentUsd: number;
}

export async function runAuto(input: AutoInput): Promise<AutoResult> {
  const taskId = input.taskId ?? "TASK-001";
  const guard = createCostGuard(input.maxCostUsd);
  const ws = await mkdtemp(join(tmpdir(), "nekoforge-auto-"));

  await runInit({ cwd: ws });

  try {
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
    const skillGuidance = await resolveSkillGuidance(deps);
    const prompt = workers
      ? renderPrompt(taskId, "implementation-worker", workers, { goal: input.goal, spec, plan, autonomous: true, skillGuidance })
      : `# Worker Prompt\ntask: ${taskId}\nrole: implementation-worker\ngoal: ${input.goal}\n`;

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

    // 워크스페이스는 일회용 — 사람이 봐야 할 REPORT.md 본문만 건져서 결과에 담는다.
    // (워커 편집·diff 캡처는 모두 호출자 cwd 기준이라 ws 에 남길 실동작 흐름이 없다.)
    const report = await readFile(join(ws, r.reportPath), "utf8").catch(() => "");

    return {
      verdict: r.verdict,
      triggeredRules: r.triggeredRules,
      report,
      workspace: ws,
      applied: false,
      spentUsd: guard.spent()
    };
  } finally {
    // 정상/오류 모두 임시 폴더를 정리한다(누적 leak 방지). 정리 실패는 verdict 를 깨지 않게 best-effort.
    await rm(ws, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}
