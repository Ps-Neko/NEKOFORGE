/**
 * workers.json schema — Phase WF (Worker Factory).
 */
export const workersSchema = {
  $id: "workers",
  type: "object",
  required: ["schemaVersion", "profile", "workers"],
  properties: {
    schemaVersion: { type: "string", const: "0.5" },
    profile: {
      type: "string",
      enum: ["minimal", "standard", "strict"]
    },
    workers: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "role"],
        properties: {
          id: { type: "string", minLength: 1 },
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
          allowedStages: {
            type: "array",
            items: { type: "string" }
          },
          canWriteDecision: { type: "boolean" },
          canApply: { type: "boolean" },
          forbiddenActionsDeclared: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    roleSeparation: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2
      }
    }
  }
} as const;
