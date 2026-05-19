/**
 * workers stage (Phase WF) — init/list/status/validate.
 *
 * 책임:
 * - profile 별 default workers 생성
 * - workers.json 읽기/검증
 * - completion status 계산
 */
import type { StageDeps } from "../core/stage-runner.js";
import { validateRoleSeparation } from "./validate.js";
import type {
  WorkerDef,
  WorkerProfile,
  WorkerRole,
  WorkersJson
} from "./types.js";

export type { WorkerProfile, WorkerRole, WorkerDef, WorkersJson } from "./types.js";

export class WorkersError extends Error {
  readonly exitCode = 10;
  constructor(msg: string) {
    super(msg);
    this.name = "WorkersError";
  }
}

const DEFAULT_FORBIDDEN = ["no-commit", "no-push", "no-deploy", "no-apply"];

const PROFILE_ROLES: Record<WorkerProfile, WorkerRole[]> = {
  minimal: ["implementation-worker"],
  standard: ["implementation-worker", "test-worker", "security-reviewer"],
  strict: [
    "architect",
    "implementation-worker",
    "test-worker",
    "security-reviewer",
    "design-reviewer",
    "release-gatekeeper"
  ]
};

const DEFAULT_ROLE_SEPARATION: Array<[WorkerRole, WorkerRole]> = [
  ["implementation-worker", "security-reviewer"],
  ["implementation-worker", "release-gatekeeper"]
];

function makeWorker(role: WorkerRole, idx: number): WorkerDef {
  return {
    id: `${role.split("-")[0]}-${idx}`,
    role,
    allowedStages: ["work", "review"],
    canWriteDecision: false,
    canApply: false,
    forbiddenActionsDeclared: [...DEFAULT_FORBIDDEN]
  };
}

export interface InitInput {
  profile?: WorkerProfile;
  force?: boolean;
}

export async function runWorkersInit(
  input: InitInput,
  deps: StageDeps
): Promise<{ profile: WorkerProfile; workersJsonPath: string }> {
  const profile: WorkerProfile = input.profile ?? "standard";
  const existing = await deps.artifact.exists("workers.json");
  if (existing && !input.force) {
    throw new WorkersError(
      "workers.json already exists (use --force to overwrite)"
    );
  }
  const workers = PROFILE_ROLES[profile].map((r, i) => makeWorker(r, i + 1));
  const data: WorkersJson = {
    schemaVersion: "0.5",
    profile,
    workers,
    roleSeparation: DEFAULT_ROLE_SEPARATION
  };
  await deps.artifact.writeJson("workers.json", data, "workers");
  return { profile, workersJsonPath: ".harness/workers.json" };
}

export async function readWorkers(
  deps: StageDeps
): Promise<WorkersJson | null> {
  return deps.artifact
    .readJson<WorkersJson>("workers.json", "workers")
    .catch(() => null);
}

export interface WorkersStatus {
  configured: boolean;
  profile: WorkerProfile | null;
  workerCount: number;
  roles: WorkerRole[];
  separationOk: boolean;
  separationViolations: string[];
}

export async function getWorkersStatus(
  deps: StageDeps
): Promise<WorkersStatus> {
  const w = await readWorkers(deps);
  if (!w) {
    return {
      configured: false,
      profile: null,
      workerCount: 0,
      roles: [],
      separationOk: true,
      separationViolations: []
    };
  }
  const violations = validateRoleSeparation(w.workers, w.roleSeparation);
  return {
    configured: true,
    profile: w.profile,
    workerCount: w.workers.length,
    roles: w.workers.map((x) => x.role),
    separationOk: violations.length === 0,
    separationViolations: violations
  };
}

export function profileRequiredRoles(profile: WorkerProfile): WorkerRole[] {
  return [...PROFILE_ROLES[profile]];
}
