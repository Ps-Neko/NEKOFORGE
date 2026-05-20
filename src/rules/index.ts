/**
 * deterministic rule 레지스트리.
 *
 * - ALL_RULES : 보안/공정 9종 (gate 의 verdict 직접 입력).
 * - ALL_ARCHITECTURE_RULES : 구조 품질 4종 (Phase QF).
 * - ALL_DESIGN_RULES : UI/UX 품질 3종 (Phase QF, uiTouched 시만).
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
import { largeFileRiskRule } from "./architecture/large-file-risk.js";
import { layerViolationRule } from "./architecture/layer-violation.js";
import { untypedApiRiskRule } from "./architecture/untyped-api-risk.js";
import { circularDependencyRiskRule } from "./architecture/circular-dependency-risk.js";
import { accessibilityRiskRule } from "./design/accessibility-risk.js";
import { designTokenViolationRule } from "./design/design-token-violation.js";
import { responsiveBreakRiskRule } from "./design/responsive-break-risk.js";
import { missingInputValidationRiskRule } from "./api/missing-input-validation-risk.js";
import { missingRateLimitRiskRule } from "./api/missing-rate-limit-risk.js";
import { unsafeErrorExposureRiskRule } from "./api/unsafe-error-exposure-risk.js";
import { missingAuthBoundaryRiskRule } from "./api/missing-auth-boundary-risk.js";
import { unboundedVersionRiskRule } from "./dependency/unbounded-version-risk.js";
import { postinstallScriptRiskRule } from "./dependency/postinstall-script-risk.js";
import { newRuntimeDependencyRiskRule } from "./dependency/new-runtime-dependency-risk.js";
import { lockfileMismatchRiskRule } from "./dependency/lockfile-mismatch-risk.js";
import { staleCountRiskRule } from "./docs/stale-count-risk.js";
import { missingCliDocRiskRule } from "./docs/missing-cli-doc-risk.js";
import { brokenDocLinkRiskRule } from "./docs/broken-doc-link-risk.js";
import { missingReleaseNoteRiskRule } from "./release-evidence/missing-release-note-risk.js";
import { missingSelfHostRiskRule } from "./release-evidence/missing-self-host-risk.js";
import { missingMigrationNoteRiskRule } from "./release-evidence/missing-migration-note-risk.js";
import { missingExternalReviewRiskRule } from "./release-evidence/missing-external-review-risk.js";
import { interactiveDivRiskRule } from "./frontend/interactive-div-risk.js";
import { missingFocusStateRiskRule } from "./frontend/missing-focus-state-risk.js";
import { missingLoadingStateRiskRule } from "./frontend/missing-loading-state-risk.js";
import { contrastTokenRiskRule } from "./frontend/contrast-token-risk.js";

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

export const ALL_ARCHITECTURE_RULES: readonly DeterministicRule[] = [
  largeFileRiskRule,
  layerViolationRule,
  untypedApiRiskRule,
  circularDependencyRiskRule
];

export const ALL_DESIGN_RULES: readonly DeterministicRule[] = [
  accessibilityRiskRule,
  designTokenViolationRule,
  responsiveBreakRiskRule
];

// Phase RP-2 — api-safety / dependency-risk pack 의 deterministic rule.
export const ALL_API_RULES: readonly DeterministicRule[] = [
  missingInputValidationRiskRule,
  missingRateLimitRiskRule,
  unsafeErrorExposureRiskRule,
  missingAuthBoundaryRiskRule
];

export const ALL_DEPENDENCY_RULES: readonly DeterministicRule[] = [
  unboundedVersionRiskRule,
  postinstallScriptRiskRule,
  newRuntimeDependencyRiskRule,
  lockfileMismatchRiskRule
];

// Phase RP-2 후속 — docs / release-evidence / frontend pack 의 deterministic rule.
export const ALL_DOCS_RULES: readonly DeterministicRule[] = [
  staleCountRiskRule,
  missingCliDocRiskRule,
  brokenDocLinkRiskRule
];

export const ALL_RELEASE_EVIDENCE_RULES: readonly DeterministicRule[] = [
  missingReleaseNoteRiskRule,
  missingSelfHostRiskRule,
  missingMigrationNoteRiskRule,
  missingExternalReviewRiskRule
];

// frontend-accessibility pack 의 추가 휴리스틱. accessibility-risk 와 중복 발화 가능.
export const ALL_FRONTEND_RULES: readonly DeterministicRule[] = [
  interactiveDivRiskRule,
  missingFocusStateRiskRule,
  missingLoadingStateRiskRule,
  contrastTokenRiskRule
];

export { evaluateAutoApplyBlock, AutoApplyBlockedError } from "./auto-apply-block.js";
export type {
  DeterministicRule,
  RuleContext,
  RuleFinding,
  Severity
} from "./types.js";
