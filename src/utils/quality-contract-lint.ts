/**
 * quality-contract content lint (Phase QF self-audit #2-1).
 *
 * `core/quality-contract` 와 `core/work` 양쪽에서 사용. utils 에 두어 cross-stage 회피.
 */

const PLACEHOLDER_RE = /\(사용자가 작성\)|\(작성\)|^$|^\s*$/;

export interface ProductIntentLike {
  user: string;
  problem: string;
  coreValue: string;
}

export function lintProductIntent(intent: ProductIntentLike): string[] {
  const violations: string[] = [];
  if (PLACEHOLDER_RE.test(intent.user))
    violations.push("productIntent.user is placeholder");
  if (PLACEHOLDER_RE.test(intent.problem))
    violations.push("productIntent.problem is placeholder");
  if (PLACEHOLDER_RE.test(intent.coreValue))
    violations.push("productIntent.coreValue is placeholder");
  return violations;
}
