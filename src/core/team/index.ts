import type { StageDeps } from "../stage-runner.js";

interface TeamJson {
  schemaVersion: string;
  pattern: string;
  agents: Array<{ id: string; role: string; owns: string[] }>;
}

export interface TeamResult {
  runtimePath: string;
  routingPath: string;
}

export class TeamPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`team stage requires ${missing}`);
    this.name = "TeamPrecondError";
  }
}

export class TeamLintError extends Error {
  readonly exitCode = 10;
  constructor(message: string) {
    super(message);
    this.name = "TeamLintError";
  }
}

export async function runTeam(deps: StageDeps): Promise<TeamResult> {
  const team = await deps.artifact.readJson<TeamJson>("team.json", "team");
  if (!team) {
    throw new TeamPrecondError("team.json (run `harness design`)");
  }
  if (!(await deps.artifact.exists("rules.json"))) {
    throw new TeamPrecondError("rules.json (run `harness policy`)");
  }
  if (!(await deps.artifact.exists("hooks.json"))) {
    throw new TeamPrecondError("hooks.json (run `harness policy`)");
  }

  const hasGate = team.agents.some((a) => a.role === "release-gatekeeper");
  if (!hasGate) {
    throw new TeamLintError("release-gatekeeper agent is required");
  }

  const rolesById = new Map<string, Set<string>>();
  for (const a of team.agents) {
    const s = rolesById.get(a.id) ?? new Set<string>();
    s.add(a.role);
    rolesById.set(a.id, s);
  }
  const forbidden: Array<[string, string]> = [
    ["implementation-agent", "security-reviewer"],
    ["harness-designer", "quality-policy-designer"]
  ];
  for (const [id, roles] of rolesById) {
    for (const [a, b] of forbidden) {
      if (roles.has(a) && roles.has(b)) {
        throw new TeamLintError(
          `agent "${id}" cannot hold both ${a} and ${b}`
        );
      }
    }
  }

  const routes = team.agents.flatMap((a) =>
    a.owns.map((taskId) => ({
      taskId,
      agentId: a.id,
      handoffTo:
        a.role === "implementation-agent"
          ? team.agents.find((x) => x.role === "security-reviewer")?.id
          : team.agents.find((x) => x.role === "release-gatekeeper")?.id,
      notes: `${a.role} owns this task`
    }))
  );

  const routing = {
    schemaVersion: "0.3",
    routes,
    cycleLimit: 2
  };
  await deps.artifact.writeJson("agent-routing.json", routing, "agent-routing");

  const runtime = [
    "# Team Runtime",
    "",
    `Pattern: **${team.pattern}**`,
    "",
    "## Routing",
    "",
    "| task | agent | handoff |",
    "|---|---|---|",
    ...routes.map(
      (r) => `| ${r.taskId} | ${r.agentId} | ${r.handoffTo ?? "(end)"} |`
    )
  ].join("\n");
  await deps.artifact.writeMarkdown("team-runtime.md", runtime);

  return {
    runtimePath: ".harness/team-runtime.md",
    routingPath: ".harness/agent-routing.json"
  };
}
