/**
 * quality-score.json schema (Phase QF — Quality Factory Upgrade).
 */
export const qualityScoreSchema = {
  $id: "quality-score",
  type: "object",
  required: ["schemaVersion", "taskId", "scores", "weights", "thresholds"],
  properties: {
    schemaVersion: { type: "string", const: "0.4" },
    taskId: { type: "string", minLength: 1 },
    scores: {
      type: "object",
      required: ["overall"],
      additionalProperties: { type: "number", minimum: 0, maximum: 100 }
    },
    weights: {
      type: "object",
      additionalProperties: { type: "number", minimum: 0, maximum: 1 }
    },
    thresholds: {
      type: "object",
      required: ["pass", "passWithWarnings", "needsHumanReview", "blockBelow"],
      properties: {
        pass: { type: "number", minimum: 0, maximum: 100 },
        passWithWarnings: { type: "number", minimum: 0, maximum: 100 },
        needsHumanReview: { type: "number", minimum: 0, maximum: 100 },
        blockBelow: { type: "number", minimum: 0, maximum: 100 }
      }
    },
    reasons: { type: "array", items: { type: "string" } },
    failedQualityBars: { type: "array", items: { type: "string" } }
  }
} as const;
