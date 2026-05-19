import { test } from "node:test";
import assert from "node:assert/strict";
import { createValidator, KNOWN_SCHEMA_IDS } from "../../../src/schemas/loader.js";

test("loader registers 9 schemas", () => {
  assert.equal(KNOWN_SCHEMA_IDS.length, 9);
  for (const id of [
    "decision",
    "team",
    "agent-routing",
    "rules",
    "hooks",
    "codex-findings",
    "eval-case",
    "quality-contract",
    "quality-score"
  ]) {
    assert.ok(KNOWN_SCHEMA_IDS.includes(id), `missing schema: ${id}`);
  }
});

test("decision: valid minimal decision passes", () => {
  const v = createValidator();
  const r = v.validate("decision", {
    schemaVersion: "0.4",
    project: "nekoforge",
    taskId: "TASK-001",
    workflowStage: "gate",
    verdict: "PASS",
    riskLevel: "low",
    humanApprovalRequired: false,
    humanApproved: false,
    evidence: {},
    apply: { allowed: true }
  });
  assert.ok(r.valid, r.errors.join("; "));
});

test("decision: unknown verdict fails", () => {
  const v = createValidator();
  const r = v.validate("decision", {
    schemaVersion: "0.4",
    project: "nekoforge",
    taskId: "TASK-001",
    workflowStage: "gate",
    verdict: "OK",
    riskLevel: "low",
    humanApprovalRequired: false,
    humanApproved: false,
    evidence: {},
    apply: { allowed: true }
  });
  assert.equal(r.valid, false);
});

test("team: forbidden pattern fails", () => {
  const v = createValidator();
  const r = v.validate("team", {
    schemaVersion: "0.3",
    pattern: "Free-for-all",
    agents: []
  });
  assert.equal(r.valid, false);
});

test("team: valid Producer-Reviewer passes", () => {
  const v = createValidator();
  const r = v.validate("team", {
    schemaVersion: "0.3",
    pattern: "Producer-Reviewer",
    agents: [
      { id: "a1", role: "implementation-agent", owns: ["TASK-1"] },
      { id: "a2", role: "security-reviewer", owns: ["TASK-1"] }
    ]
  });
  assert.ok(r.valid, r.errors.join("; "));
});

test("unknown schema id returns invalid result", () => {
  const v = createValidator();
  const r = v.validate("nope", {});
  assert.equal(r.valid, false);
  assert.match(r.errors[0] ?? "", /unknown schema/);
});
