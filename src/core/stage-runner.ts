/**
 * 각 단계 모듈이 공유하는 deps 헬퍼.
 * CLI commands 가 이걸 통해 stage 진입.
 */
import { FsArtifact } from "../artifact/fs-artifact.js";
import { createValidator, type SchemaValidator } from "../schemas/loader.js";
import { systemClock, type Clock } from "../utils/time.js";

export interface StageDeps {
  artifact: FsArtifact;
  validator: SchemaValidator;
  clock: Clock;
  cwd: string;
}

export function resolveWorkspaceCwd(): string {
  return process.env.HARNESS_WORKSPACE ?? process.cwd();
}

export function buildDeps(cwd: string = resolveWorkspaceCwd()): StageDeps {
  const validator = createValidator();
  return {
    artifact: new FsArtifact({ cwd, validator }),
    validator,
    clock: systemClock,
    cwd
  };
}
