/**
 * codex-findings.json schema — review adapter 결과 정규화.
 */
export const codexFindingsSchema = {
  $id: "codex-findings",
  type: "object",
  required: ["schemaVersion", "adapterId", "status", "findings"],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    adapterId: { type: "string" },
    status: {
      type: "string",
      enum: ["passed", "warnings", "failed", "not_run"]
    },
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
          line: { type: "integer", minimum: 1 }
        }
      }
    },
    rawPath: { type: "string" },
    summary: { type: "string" }
  }
} as const;
