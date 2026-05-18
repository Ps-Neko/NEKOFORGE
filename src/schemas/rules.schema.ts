/**
 * rules.json schema — QUALITY-POLICY.md §3.
 */
export const rulesSchema = {
  $id: "rules",
  type: "object",
  required: ["schemaVersion", "applied"],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    language: { type: "string" },
    frameworks: { type: "array", items: { type: "string" } },
    applied: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "scope", "severity"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          scope: { type: "array", items: { type: "string" } },
          owner: { type: "string" },
          severity: {
            type: "string",
            enum: ["info", "warning", "high", "critical"]
          },
          rationale: { type: "string" }
        }
      }
    },
    deferred: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "reason"],
        properties: {
          id: { type: "string" },
          reason: { type: "string" }
        }
      }
    }
  }
} as const;
