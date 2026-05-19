/**
 * skill-packs.json schema — Phase RP.
 */
export const skillPacksSchema = {
  $id: "skill-packs",
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
    recommendedForTemplates: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "string" }
      }
    }
  }
} as const;
