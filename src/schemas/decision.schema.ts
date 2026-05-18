/**
 * decision.json schema — ARCHITECTURE.md §9 단일 출처.
 */
export const decisionSchema = {
  $id: "decision",
  type: "object",
  required: [
    "schemaVersion",
    "project",
    "taskId",
    "workflowStage",
    "verdict",
    "riskLevel",
    "humanApprovalRequired",
    "humanApproved",
    "evidence",
    "apply"
  ],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    project: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    workflowStage: { type: "string" },
    verdict: {
      type: "string",
      enum: [
        "PASS",
        "PASS_WITH_WARNINGS",
        "NEEDS_HUMAN_REVIEW",
        "BLOCK",
        "INSUFFICIENT_EVIDENCE"
      ]
    },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
    humanApprovalRequired: { type: "boolean" },
    humanApproved: { type: "boolean" },
    teamArchitecture: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        agents: { type: "array" },
        orchestrator: { type: "string" }
      }
    },
    qualityPolicy: {
      type: "object",
      properties: {
        rules: { type: "string" },
        hooks: { type: "string" },
        contextPolicy: { type: "string" },
        status: {
          type: "string",
          enum: ["applied", "missing", "violated"]
        },
        violations: { type: "array" }
      }
    },
    tests: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["passed", "failed", "not_run", "insufficient"]
        },
        commands: { type: "array", items: { type: "string" } },
        summary: { type: "string" }
      }
    },
    reviewAdapters: {
      type: "array",
      items: {
        type: "object",
        required: ["adapterId", "status"],
        properties: {
          adapterId: { type: "string" },
          status: {
            type: "string",
            enum: ["passed", "warnings", "failed", "not_run"]
          },
          findingsCount: { type: "integer", minimum: 0 },
          criticalFindings: { type: "integer", minimum: 0 },
          summary: { type: "string" }
        }
      }
    },
    deterministicRules: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["passed", "failed"] },
        triggeredRules: { type: "array", items: { type: "string" } }
      }
    },
    evidence: {
      type: "object",
      additionalProperties: { type: "string" }
    },
    apply: {
      type: "object",
      required: ["allowed"],
      properties: {
        allowed: { type: "boolean" },
        reason: { type: "string" }
      }
    },
    generatedAt: { type: "string", format: "date-time" }
  }
} as const;
