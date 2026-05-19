/**
 * rule-packs.json schema — Phase RP (Rule Pack Upgrade).
 */
export const rulePacksSchema = {
  $id: "rule-packs",
  type: "object",
  required: ["schemaVersion", "enabledPacks"],
  properties: {
    schemaVersion: { type: "string", const: "0.5" },
    enabledPacks: {
      type: "array",
      items: { type: "string" }
    },
    disabledPacks: {
      type: "array",
      items: { type: "string" }
    },
    requiredForTemplates: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "string" }
      }
    }
  }
} as const;
