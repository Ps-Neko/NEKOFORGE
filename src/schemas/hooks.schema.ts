/**
 * hooks.json schema — QUALITY-POLICY.md §4.
 */
export const hooksSchema = {
  $id: "hooks",
  type: "object",
  required: ["schemaVersion", "hooks"],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    hooks: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "command"],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "pre-tool",
              "post-tool",
              "pre-apply",
              "post-review",
              "session-start",
              "session-end"
            ]
          },
          trigger: { type: "string" },
          command: { type: "string" },
          blocking: { type: "boolean" },
          describe: { type: "string" }
        }
      }
    }
  }
} as const;
