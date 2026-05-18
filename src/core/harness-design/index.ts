import type { StageDeps } from "../stage-runner.js";

const PATTERNS = [
  "Pipeline",
  "Fan-out/Fan-in",
  "Expert Pool",
  "Producer-Reviewer",
  "Supervisor",
  "Hierarchical Delegation"
] as const;

export type TeamPattern = (typeof PATTERNS)[number];

export interface DesignInput {
  pattern?: TeamPattern;
  auto?: boolean;
}

export interface DesignResult {
  designPath: string;
  teamPath: string;
  orchestratorPath: string;
  skillsMapPath: string;
  pattern: TeamPattern;
}

export class DesignPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`design stage requires ${missing}`);
    this.name = "DesignPrecondError";
  }
}

export class DesignLintError extends Error {
  readonly exitCode = 1;
  constructor(message: string) {
    super(message);
    this.name = "DesignLintError";
  }
}

const DEFAULT_AGENTS = [
  { id: "impl-1", role: "implementation-agent", owns: ["TASK-001"] },
  { id: "sec-1", role: "security-reviewer", owns: ["TASK-001"] },
  { id: "rel-1", role: "release-gatekeeper", owns: ["TASK-001"] }
];

export async function runDesign(
  input: DesignInput,
  deps: StageDeps
): Promise<DesignResult> {
  if (!(await deps.artifact.exists("PLAN.md"))) {
    throw new DesignPrecondError("PLAN.md (run `harness plan`)");
  }
  if (input.pattern && !PATTERNS.includes(input.pattern)) {
    throw new DesignLintError(`unknown pattern: ${input.pattern}`);
  }
  const pattern: TeamPattern = input.pattern ?? "Pipeline";

  const teamJson = {
    schemaVersion: "0.3",
    pattern,
    rationale: `Default ${pattern} chosen by harness design.`,
    agents: DEFAULT_AGENTS,
    orchestratorRef: ".harness/orchestrator.md",
    skillsMapRef: ".harness/skills-map.json"
  };
  await deps.artifact.writeJson("team.json", teamJson, "team");

  const orchestrator = [
    "# Orchestrator",
    "",
    `## Pattern\n${pattern}`,
    "",
    "## Flow",
    "1. implementation-agent → security-reviewer",
    "2. security-reviewer critical>0 ? 1 단계 재호출 : 다음",
    "3. release-gatekeeper",
    "",
    "## Termination",
    "- security-reviewer 재호출 최대 2회",
    "",
    "## Handoff Rules",
    "- 모든 handoff 는 .harness/worklog.md 에 기록"
  ].join("\n");
  await deps.artifact.writeMarkdown("orchestrator.md", orchestrator);

  const skillsMap = {
    schemaVersion: "0.3",
    mappings: DEFAULT_AGENTS.map((a) => ({
      agentId: a.id,
      skills: ["search-first", "test-first", "review-first"],
      notes: "default"
    }))
  };
  await deps.artifact.writeJson("skills-map.json", skillsMap);

  const designMd = [
    `# Harness Design`,
    "",
    "## 1. 도메인 요약",
    "(작성)",
    "",
    "## 2. 선택한 패턴",
    `- ${pattern}`,
    "- 이유: 기본값 (사용자 지정 또는 자동 추천 시 갱신)",
    "",
    "## 3. 채택한 role 목록",
    "- implementation-agent, security-reviewer, release-gatekeeper",
    "",
    "## 4. orchestrator 요약",
    "- 위 orchestrator.md 참고",
    "",
    "## 5. agent ↔ skill 후보 매핑 요약",
    "- skills-map.json 참고",
    "",
    "## 6. 다음 단계 (quality-policy) 에 넘길 핵심 결정",
    "- rule 묶음 후보",
    "- hook 유형 후보"
  ].join("\n");
  await deps.artifact.writeMarkdown("harness-design.md", designMd);

  return {
    designPath: ".harness/harness-design.md",
    teamPath: ".harness/team.json",
    orchestratorPath: ".harness/orchestrator.md",
    skillsMapPath: ".harness/skills-map.json",
    pattern
  };
}

export { PATTERNS };
