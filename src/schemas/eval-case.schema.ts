/**
 * eval-case schema — memory/eval-cases/*.json.
 */
export const evalCaseSchema = {
  $id: "eval-case",
  type: "object",
  required: ["id", "kind", "summary"],
  properties: {
    id: { type: "string" },
    kind: {
      type: "string",
      enum: [
        "false_positive",
        "false_negative",
        "missed_risk",
        "useful_rule",
        "noisy_rule",
        "improved_prompt",
        "changed_workflow",
        "milestone_passed"
      ]
    },
    summary: { type: "string" },
    relatedRule: { type: "string" },
    relatedTaskId: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    sourceVerdict: { type: "string" },
    notes: { type: "string" }
  }
} as const;
