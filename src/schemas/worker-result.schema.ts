/**
 * worker-result.json schema — Phase WF.
 * 각 .harness/worker-runs/<task>/<worker>.result.json 의 형식.
 */
export const workerResultSchema = {
  $id: "worker-result",
  type: "object",
  required: ["schemaVersion", "taskId", "workerId", "role", "status"],
  properties: {
    schemaVersion: { type: "string", const: "0.5" },
    taskId: { type: "string", minLength: 1 },
    workerId: { type: "string", minLength: 1 },
    role: {
      type: "string",
      enum: [
        "product-questioner",
        "architect",
        "implementation-worker",
        "test-worker",
        "refactor-worker",
        "security-reviewer",
        "design-reviewer",
        "release-gatekeeper"
      ]
    },
    status: {
      type: "string",
      enum: ["completed", "failed", "skipped", "needs_input"]
    },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "title"],
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "high", "critical"]
          },
          title: { type: "string" },
          detail: { type: "string" },
          file: { type: "string" },
          line: { type: "integer", minimum: 0 }
        }
      }
    },
    evidence: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        result: { type: "string" }
      }
    },
    forbiddenActionsDeclared: {
      type: "array",
      items: { type: "string" }
    },
    generatedAt: { type: "string", format: "date-time" }
  }
} as const;
