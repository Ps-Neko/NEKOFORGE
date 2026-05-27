/**
 * Worker dispatch (Phase WF).
 *
 * 1차 MVP: prompt 생성 + result import. 실제 LLM 자동 실행은 Phase WF-2.
 */
import type { StageDeps } from "../core/stage-runner.js";
import type { WorkerRole, WorkersJson } from "./index.js";
import { profileRequiredRoles, readWorkers, WorkersError } from "./index.js";
import { resolveSkillGuidance } from "../skill-packs/index.js";

export interface DispatchInput {
  taskId: string;
  worker: WorkerRole;
}

export interface DispatchAllInput {
  taskId: string;
  profile?: "minimal" | "standard" | "strict";
}

export interface DispatchResult {
  promptPath: string;
  promptBody: string;
}

export interface DispatchAllResult {
  taskId: string;
  prompts: Array<{ role: WorkerRole; path: string }>;
  manifestPath: string;
  handoffPath: string;
}

const ROLE_PROMPT: Record<WorkerRole, string> = {
  "product-questioner":
    "사용자/문제/핵심 가치를 7문항(누가/왜/없으면 무슨일/핵심기능/안할것/성공기준/실패기준) 기준으로 정리하라. quality-contract.json 의 productIntent 와 정합되어야 한다.",
  architect:
    "주어진 SPEC.md/PLAN.md 의 task 에 대해 모듈 경계, 의존성 방향, 단계 분리 가능성을 2~3문단으로 제안하라. 본 worker 는 코드를 직접 작성하지 않는다.",
  "implementation-worker":
    "주어진 task 의 minimal viable 구현안을 제시하라. 테스트 코드는 test-worker 가 따로 담당. decision.json 작성 금지, commit/push/deploy/apply 금지.",
  "test-worker":
    "구현 대상의 happy path 1건 + edge case 2건 + failure case 1건 의 테스트 케이스를 작성하라. 기존 테스트를 삭제하거나 .skip 하지 않는다.",
  "refactor-worker":
    "중복 / 800 LOC 초과 파일 / 타입 명확도 / 단방향 의존성 측면에서 개선안 제시. 동작 변경 금지.",
  "security-reviewer":
    "secret-fallback / auth-bypass / dangerous-file-write / hook-injection / agent-permission / test-deletion 관점에서 risk 검토. critical 발견 시 worker-result.findings 에 critical 로 기록.",
  "design-reviewer":
    "uiTouched=true 면 accessibility / design-token / responsive-break 관점 검토. 본 worker 는 uiTouched=true 일 때만 required.",
  "release-gatekeeper":
    "release readiness 검토 — CHANGELOG, migration note, rollback path, benchmark smoke. decision.json 작성은 절대 금지 (gate 단독 책임)."
};

export async function runDispatch(
  input: DispatchInput,
  deps: StageDeps
): Promise<DispatchResult> {
  const workers = await readWorkers(deps);
  if (!workers) {
    throw new WorkersError(
      "workers.json missing (run `harness workers init`)"
    );
  }
  const isKnownRole = workers.workers.some((w) => w.role === input.worker);
  if (!isKnownRole) {
    throw new WorkersError(
      `worker role "${input.worker}" not configured in workers.json`
    );
  }
  const spec = (await deps.artifact.readMarkdown("SPEC.md")) ?? undefined;
  const plan = (await deps.artifact.readMarkdown("PLAN.md")) ?? undefined;
  const skillGuidance = await resolveSkillGuidance(deps);
  const body = renderPrompt(input.taskId, input.worker, workers, { spec, plan, skillGuidance });
  const path = `worker-runs/${input.taskId}/${input.worker}.prompt.md`;
  await deps.artifact.writeMarkdown(path, body);
  return {
    promptPath: `.harness/${path}`,
    promptBody: body
  };
}

export async function runDispatchAll(
  input: DispatchAllInput,
  deps: StageDeps
): Promise<DispatchAllResult> {
  const workers = await readWorkers(deps);
  if (!workers) {
    throw new WorkersError(
      "workers.json missing (run `harness workers init`)"
    );
  }
  const profile = input.profile ?? workers.profile;
  const required = profileRequiredRoles(profile);
  // workers.json 안에 정의된 role 만 dispatch (required 와 교차).
  const definedRoles = new Set(workers.workers.map((w) => w.role));
  const roles = required.filter((r) => definedRoles.has(r));
  const spec = (await deps.artifact.readMarkdown("SPEC.md")) ?? undefined;
  const plan = (await deps.artifact.readMarkdown("PLAN.md")) ?? undefined;
  const skillGuidance = await resolveSkillGuidance(deps);
  const prompts: Array<{ role: WorkerRole; path: string }> = [];
  for (const role of roles) {
    const body = renderPrompt(input.taskId, role, workers, { spec, plan, skillGuidance });
    const rel = `worker-runs/${input.taskId}/${role}.prompt.md`;
    await deps.artifact.writeMarkdown(rel, body);
    prompts.push({ role, path: `.harness/${rel}` });
  }
  // manifest
  const manifest = {
    schemaVersion: "0.5",
    taskId: input.taskId,
    profile,
    requiredRoles: required,
    dispatchedRoles: roles,
    prompts: prompts.map((p) => ({ role: p.role, path: p.path })),
    generatedAt: new Date().toISOString()
  };
  const manifestRel = `worker-runs/${input.taskId}/worker-run-manifest.json`;
  await deps.artifact.writeJson(manifestRel, manifest);
  // handoff (전역 1개 — 마지막 dispatch 결과)
  const handoffBody = [
    `# Worker Handoff — ${input.taskId}`,
    "",
    `- profile: ${profile}`,
    `- required roles: ${required.join(", ")}`,
    `- dispatched roles: ${roles.join(", ")}`,
    "",
    `## prompts`,
    "",
    ...prompts.map((p) => `- ${p.role}: ${p.path}`),
    "",
    `## next`,
    "",
    `1. 각 prompt 를 LLM / 외부 worker 에 입력`,
    `2. 결과를 \`.result.md\` 로 저장`,
    `3. \`harness worker-result import ${input.taskId} --worker <role> --file <result.md>\``,
    `4. 전체 회수 후 \`harness worker-result validate ${input.taskId}\` 로 검증`,
    `5. \`harness review\` → \`harness gate\``,
    ""
  ].join("\n");
  await deps.artifact.writeMarkdown("worker-handoff.md", handoffBody);
  return {
    taskId: input.taskId,
    prompts,
    manifestPath: `.harness/${manifestRel}`,
    handoffPath: ".harness/worker-handoff.md"
  };
}

export interface PromptContext { goal?: string; spec?: string; plan?: string; autonomous?: boolean; skillGuidance?: string; }

export function renderPrompt(
  taskId: string,
  role: WorkerRole,
  workers: WorkersJson,
  context: PromptContext = {}
): string {
  const profile = workers.profile;
  // 사용자 목표(goal)는 SPEC/PLAN 맥락보다 위에 둔다 — auto 경로의 기본 SPEC 은
  // self-host 자가검증용이라, goal 이 없으면 워커가 진짜 목표를 못 본다(헛코드 방지).
  const goalBlock = context.goal
    ? [`## 사용자 목표 (goal)`, "", context.goal.trim(), ""].join("\n")
    : "";
  const contextBlock = (context.spec || context.plan)
    ? [
        `## 작업 맥락 (SPEC/PLAN 발췌)`,
        "",
        context.spec ? `### SPEC\n${context.spec.slice(0, 3000)}` : "",
        context.plan ? `### PLAN\n${context.plan.slice(0, 2000)}` : "",
        ""
      ].filter(Boolean).join("\n")
    : "";
  const guidanceBlock = context.skillGuidance
    ? [`## 스킬팩 지침 (skill-pack guidance)`, "", context.skillGuidance.trim(), ""].join("\n")
    : "";

  // autonomous(auto-factory): 워커가 result.md 에 '제안서'를 쓰는 게 아니라
  // cwd 의 소스 파일을 *직접 편집*한다. 산출물 = 워킹트리 diff. harness 메타
  // (.harness/)는 건드리지 않게 막아 캡처되는 diff 오염을 방지한다.
  if (context.autonomous) {
    const mission =
      role === "implementation-worker"
        ? "주어진 task 를 **실제로 구현하라**. 작업 디렉터리(cwd)의 소스 파일을 직접 생성/편집해 동작하는 코드를 남겨라 — 너에겐 편집 권한이 있다. 구현안을 글로 *설명*만 하지 말고 *파일을 실제로 바꿔라*. 너의 산출물은 워킹트리의 변경(diff) 그 자체다. 테스트 코드는 test-worker 담당이라 여기선 필수가 아니다."
        : ROLE_PROMPT[role];
    return [
      `# Worker Prompt — ${role} (autonomous · 직접 편집)`,
      "",
      `- task: ${taskId}`,
      `- profile: ${profile}`,
      `- role: ${role}`,
      `- mode: 실제 파일 편집 (산출물 = 워킹트리 diff, result.md 아님)`,
      "",
      goalBlock,
      contextBlock,
      guidanceBlock,
      `## 임무`,
      "",
      mission,
      "",
      `## 절대 하지 않을 것`,
      "",
      "- git commit / push / deploy 실행, `harness apply` 실행 — 변경은 워킹트리에 남기기만 하라(게이트·사람이 이후 판단).",
      "- `.harness/` 디렉터리에 파일 쓰기 — harness 전용 영역이라 여기 쓰면 캡처되는 diff 가 오염된다.",
      "- decision.json / audit.jsonl 직접 작성·수정",
      "- 기존 테스트 삭제 또는 .skip 마커 추가",
      "- quality-contract.json 의 qualityBars 약화",
      ""
    ].join("\n");
  }

  return [
    `# Worker Prompt — ${role}`,
    "",
    `- task: ${taskId}`,
    `- profile: ${profile}`,
    `- role: ${role}`,
    `- forbidden actions: no-commit, no-push, no-deploy, no-apply, no-decision-write`,
    "",
    goalBlock,
    contextBlock,
    guidanceBlock,
    `## 임무`,
    "",
    ROLE_PROMPT[role],
    "",
    `## 결과 위치`,
    "",
    `\`.harness/worker-runs/${taskId}/${role}.result.md\` (markdown 본문)`,
    `\`.harness/worker-runs/${taskId}/${role}.result.json\` (구조화 finding)`,
    "",
    `## 절대 하지 않을 것`,
    "",
    `- decision.json 직접 작성/수정`,
    `- audit.jsonl 직접 수정`,
    `- commit/push/deploy/apply 실행`,
    `- quality-contract.json 의 qualityBars 약화`,
    `- 다른 worker 의 result 덮어쓰기`,
    "",
    `## 결과 schema (worker-result.json)`,
    "",
    "```json",
    JSON.stringify(
      {
        schemaVersion: "0.5",
        taskId,
        workerId: workers.workers.find((w) => w.role === role)?.id ?? role,
        role,
        status: "completed",
        summary: "(요약 한 문장)",
        findings: [],
        forbiddenActionsDeclared: [
          "no-commit",
          "no-push",
          "no-deploy",
          "no-apply"
        ]
      },
      null,
      2
    ),
    "```",
    ""
  ].join("\n");
}
