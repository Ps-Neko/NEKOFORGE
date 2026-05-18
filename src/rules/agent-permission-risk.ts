/**
 * SECURITY.md §3.7 — agent 권한 확장·겸직 탐지 (v3 신규).
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "agent-permission-risk";

const TEAM_FILE_PATTERNS = [
  /(^|\/)\.harness\/team\.json$/,
  /(^|\/)\.harness\/agent-routing\.json$/,
  /(^|\/)\.claude\/agents\//
];

const FORBIDDEN_PAIRS: Array<[string, string]> = [
  ["implementation-agent", "security-reviewer"],
  ["implementation-agent", "release-gatekeeper"],
  ["harness-designer", "quality-policy-designer"]
];

export const agentPermissionRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "agent 권한 확장 또는 핵심 역할 겸직 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];

    for (const f of ctx.diff.files) {
      if (TEAM_FILE_PATTERNS.some((p) => p.test(f.path))) {
        findings.push(
          makeFinding(
            RULE_ID,
            "high",
            `agent permission/team file modified: ${f.path}`,
            { file: f.path }
          )
        );
      }
    }

    const agents = ctx.team?.agents ?? [];
    const rolesById = new Map<string, Set<string>>();
    for (const a of agents) {
      const set = rolesById.get(a.id) ?? new Set<string>();
      set.add(a.role);
      rolesById.set(a.id, set);
    }
    for (const [id, roles] of rolesById) {
      for (const [a, b] of FORBIDDEN_PAIRS) {
        if (roles.has(a) && roles.has(b)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "high",
              `agent "${id}" holds incompatible roles ${a} + ${b}`
            )
          );
        }
      }
    }

    return findings;
  }
};
