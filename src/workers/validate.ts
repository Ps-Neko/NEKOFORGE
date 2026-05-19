/**
 * Worker role separation validator (Phase WF).
 *
 * 같은 worker.id 가 분리되어야 할 두 역할을 모두 owns 하면 위반.
 * roleSeparation 예: [["implementation-worker","security-reviewer"], ...]
 */
import type { WorkerDef, WorkerRole } from "./types.js";

export function validateRoleSeparation(
  workers: ReadonlyArray<WorkerDef>,
  pairs: ReadonlyArray<readonly [WorkerRole, WorkerRole]>
): string[] {
  const violations: string[] = [];
  // ID → roles set
  const byId = new Map<string, Set<WorkerRole>>();
  for (const w of workers) {
    const set = byId.get(w.id) ?? new Set<WorkerRole>();
    set.add(w.role);
    byId.set(w.id, set);
  }
  for (const [id, roles] of byId) {
    for (const [a, b] of pairs) {
      if (roles.has(a) && roles.has(b)) {
        violations.push(`${id} holds both ${a} and ${b}`);
      }
    }
  }
  return violations;
}

const FORBIDDEN_PATTERNS: ReadonlyArray<{ rule: string; re: RegExp }> = [
  { rule: "decision-write", re: /\bdecision\.json\b/i },
  { rule: "git-commit", re: /\bgit\s+commit\b/i },
  { rule: "git-push", re: /\bgit\s+push\b/i },
  { rule: "deploy", re: /\b(deploy|kubectl\s+apply|terraform\s+apply)\b/i },
  { rule: "harness-apply", re: /\bharness\s+apply\b/i },
  { rule: "audit-write", re: /\baudit\.jsonl\b/i }
];

export interface ForbiddenHit {
  rule: string;
  match: string;
}

export function detectForbiddenActions(text: string): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  for (const { rule, re } of FORBIDDEN_PATTERNS) {
    const m = re.exec(text);
    if (m) hits.push({ rule, match: m[0] });
  }
  return hits;
}
