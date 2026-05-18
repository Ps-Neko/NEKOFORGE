/**
 * agent-routing.json schema — WORKFLOW.md §3.8.
 */
export const agentRoutingSchema = {
  $id: "agent-routing",
  type: "object",
  required: ["schemaVersion", "routes"],
  properties: {
    schemaVersion: { type: "string", const: "0.3" },
    routes: {
      type: "array",
      items: {
        type: "object",
        required: ["taskId", "agentId"],
        properties: {
          taskId: { type: "string" },
          agentId: { type: "string" },
          handoffTo: { type: "string" },
          notes: { type: "string" }
        }
      }
    },
    cycleLimit: { type: "integer", minimum: 1 }
  }
} as const;
