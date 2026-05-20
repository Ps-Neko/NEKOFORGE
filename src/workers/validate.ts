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

/**
 * codex review v0.5 Finding #M1 — 부정형 표현 ("do not git push", "금지", "막아야")
 * 가 본 hit 주변 (±40 chars) 에 있으면 false positive 로 간주하고 무시.
 *
 * 정확도 vs 미탐 trade-off: 본 휴리스틱은 명시적 금지 안내문을 식별. 우회 시도가
 * "git push 는 금지" 같은 표현으로 위장하면 미탐 가능 — 의도된 한계로 docs/WORKER-SAFETY.md 에 명시.
 */
const NEGATION_RE =
  /(\bdo not\b|\bdon't\b|\bnever\b|\bmust not\b|\bshould not\b|\bavoid\b|\bprohibit\b|금지|막아야|회피|하지\s*마|하면\s*안|않는다|불가)/i;

export interface ForbiddenHit {
  rule: string;
  match: string;
}

function isInNegationContext(text: string, matchIndex: number, matchLen: number): boolean {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + matchLen + 40);
  return NEGATION_RE.test(text.slice(start, end));
}

export function detectForbiddenActions(text: string): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  for (const { rule, re } of FORBIDDEN_PATTERNS) {
    // 본 문서에서 같은 패턴의 모든 발화를 검사 — 일부는 negation 으로 무시.
    const reAll = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = reAll.exec(text)) !== null) {
      if (!isInNegationContext(text, m.index, m[0].length)) {
        hits.push({ rule, match: m[0] });
        break; // rule 당 1 hit 면 충분 (기존 동작 호환).
      }
    }
  }
  return hits;
}
