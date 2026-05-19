/**
 * T-SEC e2e 시나리오 공용 시드.
 *
 * spawn 없이 core 모듈을 직접 호출해서 .harness/ 를 정상 상태까지 만든다.
 * 각 케이스가 시드 후 last-diff.patch 또는 다른 artifact 만 변형해서 gate/apply 시험.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../../src/core/init.js";
import { buildDeps, type StageDeps } from "../../src/core/stage-runner.js";
import { runIntake } from "../../src/core/intake/index.js";
import { runClarify } from "../../src/core/clarify/index.js";
import { runContext } from "../../src/core/context/index.js";
import { runSpec } from "../../src/core/spec/index.js";
import { runPlan } from "../../src/core/plan/index.js";
import { runDesign } from "../../src/core/harness-design/index.js";
import { runPolicy } from "../../src/core/quality-policy/index.js";
import { runTeam } from "../../src/core/team/index.js";
import { runWork } from "../../src/core/work/index.js";
import { runReview } from "../../src/core/review/index.js";
import { createCodexStubAdapter } from "../../src/integrations/codex/stub.js";
import { runQualityContract } from "../../src/core/quality-contract/index.js";

export interface SeededWorkspace {
  cwd: string;
  deps: StageDeps;
  cleanup: () => Promise<void>;
}

const SPEC_ANSWERS = {
  who: "관리자",
  why: "보안 강화",
  problemIfMissing: "탈취 위험",
  coreFeatures: "잠금 기능",
  notDoing: "이메일 알림",
  successCriteria: "잠금 발동률 99%",
  failureCriteria: "오작동 1% 이상"
};

export async function seedHarness(): Promise<SeededWorkspace> {
  const cwd = await mkdtemp(join(tmpdir(), "vh-tsec-"));
  await runInit({ cwd });
  const deps = buildDeps(cwd);

  await runIntake({ goal: "T-SEC seed" }, deps);
  await runClarify(deps);
  await runContext(deps);

  const answersFile = join(cwd, "answers.json");
  await writeFile(answersFile, JSON.stringify(SPEC_ANSWERS), "utf8");
  await runSpec({ answersFile }, deps);

  await runPlan({}, deps);
  await runDesign({ pattern: "Pipeline" }, deps);
  await runPolicy({}, deps);

  // 테스트 시드는 외부 spawn 회피를 위해 hooks 를 internal:noop 로 덮어쓴다.
  // 실제 사용자 환경에서는 quality-policy 의 default (npx tsc --noEmit 등) 이 동작.
  await deps.artifact.writeJson(
    "hooks.json",
    {
      schemaVersion: "0.3",
      hooks: [
        { id: "noop-pre", type: "pre-tool", command: "internal:noop" },
        { id: "noop-post", type: "post-tool", command: "internal:noop" }
      ]
    },
    "hooks"
  );

  await runTeam(deps);

  // Phase QF — work 전에 quality-contract 필수.
  // self-audit #2-1 — work 가 productIntent placeholder 거부하므로 진짜 답변 시드.
  const contractAnswers = join(cwd, "contract-answers.json");
  await writeFile(
    contractAnswers,
    JSON.stringify({
      user: "test seed user",
      problem: "test seed problem",
      coreValue: "test seed value"
    }),
    "utf8"
  );
  await runQualityContract(
    { taskId: "TASK-001", template: "custom", answersFile: contractAnswers },
    deps
  );

  await runWork({ taskId: "TASK-001" }, deps);
  await runReview(
    {
      adapters: [
        createCodexStubAdapter({ enabled: true, forceStatus: "passed" })
      ]
    },
    deps
  );
  // Codex review #3 — Evidence before Apply 가 quality-score.json + REPORT.md 를 요구한다.
  // 테스트들은 대부분 직접 runGate 를 호출해 새로 생성하지만, gate 를 호출하지 않고
  // 바로 runApply 만 시험하는 경우 (decision.json 직접 주입형) 를 위해 최소 시드를 만든다.
  await deps.artifact.writeJson("quality-score.json", {
    schemaVersion: "0.5",
    taskId: "TASK-001",
    scores: {
      overall: 100,
      correctness: 100,
      testCoverage: 100,
      security: 100,
      maintainability: 100,
      architecture: 100,
      ux: 100,
      performance: 100,
      evidence: 100
    },
    weights: {
      correctness: 0.2,
      testCoverage: 0.15,
      security: 0.2,
      maintainability: 0.1,
      architecture: 0.1,
      ux: 0.05,
      performance: 0.05,
      evidence: 0.15
    },
    thresholds: {
      pass: 90,
      passWithWarnings: 75,
      needsHumanReview: 60,
      blockBelow: 60
    },
    reasons: []
  });
  await writeFile(
    join(cwd, "REPORT.md"),
    "# Seed REPORT\n\nThis is a minimal REPORT.md seeded for testing.\n",
    "utf8"
  );

  return {
    cwd,
    deps,
    cleanup: () => rm(cwd, { recursive: true, force: true })
  };
}

export function diffLines(...lines: string[]): string {
  return lines.join("\n") + "\n";
}

export async function writeLastDiff(
  cwd: string,
  diff: string
): Promise<void> {
  await writeFile(join(cwd, ".harness", "last-diff.patch"), diff, "utf8");
}

export async function overwriteJson(
  cwd: string,
  relPath: string,
  data: unknown
): Promise<void> {
  await writeFile(
    join(cwd, ".harness", relPath),
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

export async function writeApproval(
  cwd: string,
  content: string
): Promise<void> {
  await writeFile(join(cwd, ".harness", "approval.txt"), content, "utf8");
}
