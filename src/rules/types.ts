/**
 * Deterministic rule 인터페이스 — ARCHITECTURE.md §6, SECURITY.md §3.
 *
 * rule 은 순수 함수. 외부 네트워크·hooks 에 의존하지 않는다.
 */
import type { Diff } from "../utils/diff.js";

export type Severity = "info" | "warning" | "high" | "critical";

export interface RuleFinding {
  ruleId: string;
  severity: Severity;
  file?: string;
  line?: number;
  message: string;
}

export interface PolicyFlags {
  testFirst?: boolean;
  securityFirst?: boolean;
  reviewFirst?: boolean;
}

export interface ReviewSnapshot {
  status: "passed" | "warnings" | "failed" | "not_run";
  adapterCount: number;
  criticalFindings: number;
}

export interface RuleContext {
  diff: Diff;
  policies?: PolicyFlags;
  review?: ReviewSnapshot;
  team?: {
    pattern?: string;
    agents?: Array<{ id: string; role: string; owns: string[] }>;
  };
  hooksCommandWhitelistViolations?: number;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  highRiskFlags?: {
    dangerousFileWrite?: boolean;
    authBypass?: boolean;
    secretFallback?: boolean;
    hookInjection?: boolean;
    agentPermissionExpansion?: boolean;
    testDeletion?: boolean;
  };
}

export interface DeterministicRule {
  id: string;
  describe: string;
  run(ctx: RuleContext): Promise<RuleFinding[]>;
}

export function makeFinding(
  ruleId: string,
  severity: Severity,
  message: string,
  extra: { file?: string; line?: number } = {}
): RuleFinding {
  return {
    ruleId,
    severity,
    message,
    ...(extra.file !== undefined ? { file: extra.file } : {}),
    ...(extra.line !== undefined ? { line: extra.line } : {})
  };
}
