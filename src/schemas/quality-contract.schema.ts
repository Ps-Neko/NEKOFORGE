/**
 * quality-contract.json schema (Phase QF — Quality Factory Upgrade).
 *
 * work 단계 이전에 강제되는 품질 계약. gate 가 verdict 결정 시 입력으로 사용.
 */
export const qualityContractSchema = {
  $id: "quality-contract",
  type: "object",
  required: [
    "schemaVersion",
    "taskId",
    "productIntent",
    "acceptanceCriteria",
    "qualityBars",
    "requiredEvidence"
  ],
  properties: {
    schemaVersion: { type: "string", const: "0.5" },
    taskId: { type: "string", minLength: 1 },
    productIntent: {
      type: "object",
      required: ["user", "problem", "coreValue"],
      properties: {
        user: { type: "string" },
        problem: { type: "string" },
        coreValue: { type: "string" },
        nonGoals: { type: "array", items: { type: "string" } }
      }
    },
    acceptanceCriteria: {
      type: "array",
      items: { type: "string" }
    },
    qualityBars: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["minimum", "required"],
        properties: {
          minimum: { type: "number", minimum: 0, maximum: 100 },
          required: { type: "boolean" }
        }
      }
    },
    riskProfile: {
      type: "object",
      properties: {
        dangerousFiles: { type: "array", items: { type: "string" } },
        authTouched: { type: "boolean" },
        secretsTouched: { type: "boolean" },
        ciTouched: { type: "boolean" },
        deployTouched: { type: "boolean" },
        uiTouched: { type: "boolean" }
      }
    },
    requiredEvidence: {
      type: "array",
      items: { type: "string" }
    },
    forbiddenActions: {
      type: "array",
      items: { type: "string" }
    },
    template: {
      type: "string",
      enum: ["web-ui", "cli-tool", "backend-api", "library", "custom"]
    }
  }
} as const;
