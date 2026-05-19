/**
 * Worker type definitions — leaf module to break workers/index ↔ workers/validate cycle.
 */
export type WorkerProfile = "minimal" | "standard" | "strict";

export type WorkerRole =
  | "product-questioner"
  | "architect"
  | "implementation-worker"
  | "test-worker"
  | "refactor-worker"
  | "security-reviewer"
  | "design-reviewer"
  | "release-gatekeeper";

export interface WorkerDef {
  id: string;
  role: WorkerRole;
  allowedStages?: string[];
  canWriteDecision: boolean;
  canApply: boolean;
  forbiddenActionsDeclared: string[];
}

export interface WorkersJson {
  schemaVersion: "0.5";
  profile: WorkerProfile;
  workers: WorkerDef[];
  roleSeparation: Array<[WorkerRole, WorkerRole]>;
}
