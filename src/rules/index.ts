/**
 * deterministic rule 9종 레지스트리.
 * gate 모듈은 본 배열을 통해 일괄 실행한다.
 */
import type { DeterministicRule } from "./types.js";
import { secretFallbackRule } from "./secret-fallback.js";
import { authBypassRule } from "./auth-bypass.js";
import { testDeletionRule } from "./test-deletion.js";
import { noTestRiskRule } from "./no-test-risk.js";
import { dangerousFileWriteRule } from "./dangerous-file-write.js";
import { hookInjectionRiskRule } from "./hook-injection-risk.js";
import { agentPermissionRiskRule } from "./agent-permission-risk.js";
import { autoApplyBlockRule } from "./auto-apply-block.js";
import { codexMissingRiskRule } from "./codex-missing-risk.js";

export const ALL_RULES: readonly DeterministicRule[] = [
  secretFallbackRule,
  authBypassRule,
  testDeletionRule,
  noTestRiskRule,
  dangerousFileWriteRule,
  hookInjectionRiskRule,
  agentPermissionRiskRule,
  autoApplyBlockRule,
  codexMissingRiskRule
];

export { evaluateAutoApplyBlock, AutoApplyBlockedError } from "./auto-apply-block.js";
export type {
  DeterministicRule,
  RuleContext,
  RuleFinding,
  Severity
} from "./types.js";
