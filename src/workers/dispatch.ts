/**
 * Worker dispatch (Phase WF).
 *
 * 1차 MVP: prompt 생성 + result import. 실제 LLM 자동 실행은 Phase WF-2.
 */
import type { StageDeps } from "../core/stage-runner.js";
import type { WorkerRole, WorkersJson } from "./index.js";
import { profileRequiredRoles, readWorkers, WorkersError } from "./index.js";

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
  const body = renderPrompt(input.taskId, input.worker, workers);
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
  const prompts: Array<{ role: WorkerRole; path: string }> = [];
  for (const role of roles) {
    const body = renderPrompt(input.taskId, role, workers);
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

function renderPrompt(
  taskId: string,
  role: WorkerRole,
  workers: WorkersJson
): string {
  const profile = workers.profile;
  return [
    `# Worker Prompt — ${role}`,
    "",
    `- task: ${taskId}`,
    `- profile: ${profile}`,
    `- role: ${role}`,
    `- forbidden actions: no-commit, no-push, no-deploy, no-apply, no-decision-write`,
    "",
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
