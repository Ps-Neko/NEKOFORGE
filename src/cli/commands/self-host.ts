/**
 * harness self-host — 본 도구로 본 도구를 14단계 자가 검증 (self-host #6 이후 단축).
 *
 * 흐름:
 *   (tmpdir 격리) init → ask → context → spec(defaults) → plan
 *   → design(Pipeline) → policy → team → contract(custom defaults)
 *   → work TASK-001 → review → gate → 결과 보고
 *
 * 정책:
 * - 실 repo 의 audit chain 을 깨뜨리지 않기 위해 **tmpdir 격리**.
 * - work 단계에서 readGitDiff 가 현재 cwd 의 git diff 를 캡처하므로 검증 의미 유지.
 * - 본 명령이 apply 까지 가지 않는다. apply 는 사람이 명시적으로.
 * - 실패하면 어느 단계에서 실패했는지 + exit code 보고.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runInit } from "../../core/init.js";
import { runIntake } from "../../core/intake/index.js";
import { runClarify } from "../../core/clarify/index.js";
import { runContext } from "../../core/context/index.js";
import { runSpec } from "../../core/spec/index.js";
import { runPlan } from "../../core/plan/index.js";
import { runDesign } from "../../core/harness-design/index.js";
import { runPolicy } from "../../core/quality-policy/index.js";
import { runTeam } from "../../core/team/index.js";
import { runQualityContract } from "../../core/quality-contract/index.js";
import { runReview } from "../../core/review/index.js";
import { runGate } from "../../core/gate/index.js";
import { readGitDiff, diffHash } from "../../utils/git.js";
import { isoNow, systemClock } from "../../utils/time.js";
import { runWorkersInit } from "../../workers/index.js";
import { ensureRulePacks } from "../../rule-packs/index.js";
import { ensureSkillPacks } from "../../skill-packs/index.js";

interface SelfHostOpts {
  goal?: string;
  taskId?: string;
  withWorkerStubs?: boolean;
}

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

const STUB_ROLES = [
  "implementation-worker",
  "test-worker",
  "security-reviewer"
] as const;

async function seedWorkerStubs(cwd: string, taskId: string): Promise<void> {
  const dir = join(cwd, ".harness", "worker-runs", taskId);
  await mkdir(dir, { recursive: true });
  for (const role of STUB_ROLES) {
    const body = [
      `# ${role} stub result`,
      "",
      `self-host --with-worker-stubs 가 생성한 placeholder.`,
      `실 결과 아님. verdict 의 PASS 여부는 본 stub 영향이 아닌 다른 약속 (failedBars / rule pack 등) 으로 판단해야 함.`,
      ""
    ].join("\n");
    await writeFile(join(dir, `${role}.result.md`), body, "utf8");
    const json = {
      schemaVersion: "0.5",
      taskId,
      workerId: `${role.split("-")[0]}-stub`,
      role,
      status: "completed",
      summary: "self-host stub — placeholder result for deeper self-check",
      findings: [],
      evidence: {
        result: `.harness/worker-runs/${taskId}/${role}.result.md`
      },
      forbiddenActionsDeclared: ["no-commit", "no-push", "no-deploy", "no-apply"]
    };
    await writeFile(
      join(dir, `${role}.result.json`),
      JSON.stringify(json, null, 2),
      "utf8"
    );
  }
}

export function registerSelfHost(program: Command): void {
  program
    .command("self-host")
    .description(
      "Run the 14-stage workflow against the current repo as a self-check (intake → gate)."
    )
    .option("--goal <text>", "user goal", "self-host 자가 검증")
    .option("--task-id <id>", "task id from TASKS.md", "TASK-001")
    .option(
      "--with-worker-stubs",
      "seed minimal worker-result stubs (impl/test/sec) for deeper self-check",
      false
    )
    .action(async (opts: SelfHostOpts) => {
      const taskId = opts.taskId ?? "TASK-001";
      const goal = opts.goal ?? "self-host 자가 검증";
      // self-host #6 후속 — 실 repo 의 .harness/ 와 audit chain 격리.
      // tmpdir 에 격리 워크스페이스 생성, work 단계의 git diff 만 실제 cwd 에서 캡처.
      const tmpWs = await mkdtemp(join(tmpdir(), "nekoforge-self-host-"));
      try {
        await runInit({ cwd: tmpWs });
        const deps = buildDeps(tmpWs);
        await runIntake({ goal }, deps);
        await runClarify(deps);
        await runContext(deps);

        const specAnswers = join(tmpWs, "spec-answers.json");
        await writeFile(specAnswers, JSON.stringify(DEFAULT_SPEC), "utf8");
        await runSpec({ answersFile: specAnswers }, deps);

        await runPlan({}, deps);
        await runDesign({ pattern: "Pipeline" }, deps);
        await runPolicy({}, deps);
        await runTeam(deps);

        const contractAnswers = join(tmpWs, "contract-answers.json");
        await writeFile(
          contractAnswers,
          JSON.stringify(DEFAULT_CONTRACT),
          "utf8"
        );
        await runQualityContract(
          { taskId, template: "custom", answersFile: contractAnswers },
          deps
        );

        // self-host #7 후속 — Phase WF/RP 도 자동 시드.
        // workers (standard profile) + rule-packs default + skill-packs default.
        await runWorkersInit({ profile: "standard", force: true }, deps);
        await ensureRulePacks(deps);
        await ensureSkillPacks(deps);

        // --with-worker-stubs — 3 worker (impl/test/sec) 의 result 도 stub 시드.
        // 정직성 주의: stub 은 항상 status=completed + findings=[] 이므로
        // verdict 를 인위적으로 올리는 위험이 있다. 본 옵션은 self-host 깊이
        // 검증용으로만 사용. 실 사용에서는 사람/AI 가 진짜 result 를 작성.
        if (opts.withWorkerStubs) {
          await seedWorkerStubs(tmpWs, taskId);
        }

        // work 단계 우회 — readGitDiff 가 tmpdir 에서 동작 못함.
        // 실 repo (process.cwd()) 의 git diff 를 self-host 가 직접 캡처해서
        // tmpdir 의 last-diff.patch + worklog.md + pending/<task>.patch 에 시드.
        // work 의 강제 (contract before, productIntent lint, hook) 는 self-host
        // 명령 진입 시 별도 시나리오로 검증 가능 (별도 self-host 변형 추가 여지).
        const diff = readGitDiff(process.cwd()) ?? "";
        const hash = diffHash(diff);
        const captured = diff.length > 0;
        const at = isoNow(systemClock);
        await deps.artifact.writeMarkdown("last-diff.patch", diff);
        await deps.artifact.writeMarkdown(`pending/${taskId}.patch`, diff);
        const entry = [
          `## ${taskId} — ${at}`,
          `- diff hash: ${hash}`,
          `- diff captured: ${captured}`,
          `- note: self-host (work 우회, 실 repo diff 시드)`,
          ""
        ].join("\n");
        await deps.artifact.writeMarkdown("worklog.md", entry + "\n");

        await runReview({ adapters: [] }, deps);
        const r = await runGate({ taskId }, deps);
        console.error(`[ok] self-host complete: verdict=${r.verdict}`);
        console.error(`[rules] ${r.triggeredRules.join(", ") || "(none)"}`);
        console.error(`[report] ${r.reportPath} (in tmpdir: ${tmpWs})`);
        console.error(`[decision] ${r.decisionPath} (in tmpdir)`);
        console.error(
          `[note] 실 repo 의 .harness/audit.jsonl 은 영향 없음 (격리 워크스페이스).`
        );
      } catch (err) {
        const e = err as Error & { exitCode?: number };
        console.error(`[error] self-host failed: ${e.message}`);
        await rm(tmpWs, { recursive: true, force: true }).catch(() => {});
        process.exit(e.exitCode ?? 1);
      }
    });
}
