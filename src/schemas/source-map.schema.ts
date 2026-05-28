/**
 * source-map.json schema — machine-readable 프로젝트 스냅샷.
 *
 * `runSourceMap()` 이 `.harness/source-map.json` 에 기록하고,
 * 다른 stage(context, packet 등)가 재사용할 수 있는 1급 artifact.
 */
export const sourceMapSchema = {
  $id: "source-map",
  type: "object",
  required: [
    "schemaVersion",
    "engineVersion",
    "generatedAt",
    "files",
    "languages",
    "packageScripts",
    "docs",
    "tests",
    "riskFiles",
    "relevantFiles",
    "limits"
  ],
  properties: {
    schemaVersion: { type: "string", const: "0.5" },
    engineVersion: { type: "string", minLength: 1 },
    generatedAt: { type: "string", format: "date-time" },
    files: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    languages: {
      type: "object",
      additionalProperties: { type: "integer", minimum: 1 }
    },
    packageScripts: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    docs: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    tests: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    riskFiles: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    relevantFiles: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    userContext: { type: "string" },
    limits: {
      type: "object",
      required: ["maxFiles", "scanned", "truncated"],
      properties: {
        maxFiles: { type: "integer", minimum: 1 },
        scanned: { type: "integer", minimum: 0 },
        truncated: { type: "boolean" }
      }
    },
    entrypoints: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    framework: { type: "string", minLength: 1 },
    packageManager: {
      type: "string",
      enum: ["npm", "yarn", "pnpm", "bun", "unknown"]
    },
    testRunner: { type: "string", minLength: 1 },
    buildCommands: {
      type: "object",
      properties: {
        build: { type: "string", minLength: 1 },
        test: { type: "string", minLength: 1 },
        typecheck: { type: "string", minLength: 1 },
        lint: { type: "string", minLength: 1 }
      }
    }
  }
} as const;
