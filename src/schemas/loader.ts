/**
 * 단일 Ajv 인스턴스에 7개 schema 를 등록한다.
 * 다른 모듈은 본 loader 만 사용. Ajv 를 직접 import 하지 않는다.
 */
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import { decisionSchema } from "./decision.schema.js";
import { teamSchema } from "./team.schema.js";
import { agentRoutingSchema } from "./agent-routing.schema.js";
import { rulesSchema } from "./rules.schema.js";
import { hooksSchema } from "./hooks.schema.js";
import { codexFindingsSchema } from "./codex-findings.schema.js";
import { evalCaseSchema } from "./eval-case.schema.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SchemaValidator {
  validate(schemaId: string, data: unknown): ValidationResult;
  has(schemaId: string): boolean;
}

const SCHEMAS = [
  decisionSchema,
  teamSchema,
  agentRoutingSchema,
  rulesSchema,
  hooksSchema,
  codexFindingsSchema,
  evalCaseSchema
];

export function createValidator(): SchemaValidator {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validators = new Map<string, ValidateFunction>();
  for (const s of SCHEMAS) {
    ajv.addSchema(s, s.$id);
    const v = ajv.getSchema(s.$id);
    if (!v) throw new Error(`failed to compile schema ${s.$id}`);
    validators.set(s.$id, v);
  }

  return {
    has(schemaId) {
      return validators.has(schemaId);
    },
    validate(schemaId, data) {
      const v = validators.get(schemaId);
      if (!v) {
        return { valid: false, errors: [`unknown schema: ${schemaId}`] };
      }
      const ok = v(data);
      if (ok) return { valid: true, errors: [] };
      const errs = (v.errors ?? []).map(
        (e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`
      );
      return { valid: false, errors: errs };
    }
  };
}

export const KNOWN_SCHEMA_IDS = SCHEMAS.map((s) => s.$id);
