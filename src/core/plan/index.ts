import type { StageDeps } from "../stage-runner.js";

export interface PlanInput {
  maxTasks?: number;
  requireTests?: boolean;
}

export interface PlanResult {
  planPath: string;
  tasksPath: string;
}

export class PlanPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`plan stage requires ${missing}`);
    this.name = "PlanPrecondError";
  }
}

const PLAN_TEMPLATE = `# PLAN

> Superpowers식 작은 task 단위. 8 컬럼 모두 채워야 한다.

- 작업 순서: TASK-001 → TASK-002 → ...
- risk list: (작성)
- rollback plan: (작성)
`;

const TASKS_TEMPLATE = `# TASKS

| id | title | depends | acceptance | tests | rollback | expectedFiles | doneCriteria |
|---|---|---|---|---|---|---|---|
| TASK-001 | (제목) | - | (수용 기준) | (테스트) | (롤백) | (변경 예정 파일) | (완료 판정) |
`;

export async function runPlan(
  _input: PlanInput,
  deps: StageDeps
): Promise<PlanResult> {
  if (!(await deps.artifact.exists("SPEC.md"))) {
    throw new PlanPrecondError("SPEC.md (run `harness spec`)");
  }
  await deps.artifact.writeMarkdown("PLAN.md", PLAN_TEMPLATE);
  await deps.artifact.writeMarkdown("TASKS.md", TASKS_TEMPLATE);
  return {
    planPath: ".harness/PLAN.md",
    tasksPath: ".harness/TASKS.md"
  };
}
