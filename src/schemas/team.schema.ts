/**
 * team.json schema — HARNESS-DESIGN.md §6.
 */
export const teamSchema = {
  $id: "team",
  type: "object",
  required: ["schemaVersion", "pattern", "agents"],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    pattern: {
      type: "string",
      enum: [
        "Pipeline",
        "Fan-out/Fan-in",
        "Expert Pool",
        "Producer-Reviewer",
        "Supervisor",
        "Hierarchical Delegation"
      ]
    },
    rationale: { type: "string" },
    agents: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "role", "owns"],
        properties: {
          id: { type: "string", minLength: 1 },
          role: {
            type: "string",
            enum: [
              "product-questioner",
              "domain-analyst",
              "architect",
              "harness-designer",
              "quality-policy-designer",
              "implementation-agent",
              "test-agent",
              "refactor-agent",
              "security-reviewer",
              "codex-review-coordinator",
              "release-gatekeeper"
            ]
          },
          owns: { type: "array", items: { type: "string" } },
          skillsCandidates: { type: "array", items: { type: "string" } },
          rulesCandidates: { type: "array", items: { type: "string" } },
          hooksCandidates: { type: "array", items: { type: "string" } }
        }
      }
    },
    orchestratorRef: { type: "string" },
    skillsMapRef: { type: "string" }
  }
} as const;
