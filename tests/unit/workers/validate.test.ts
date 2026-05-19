/**
 * Worker role separation + forbidden action validator tests (Phase WF).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRoleSeparation,
  detectForbiddenActions
} from "../../../src/workers/validate.js";
import type { WorkerDef } from "../../../src/workers/types.js";

const F = ["no-commit", "no-push", "no-deploy", "no-apply"];

test("validateRoleSeparation: distinct ids → no violation", () => {
  const workers: WorkerDef[] = [
    {
      id: "impl-1",
      role: "implementation-worker",
      canWriteDecision: false,
      canApply: false,
      forbiddenActionsDeclared: F
    },
    {
      id: "sec-1",
      role: "security-reviewer",
      canWriteDecision: false,
      canApply: false,
      forbiddenActionsDeclared: F
    }
  ];
  const v = validateRoleSeparation(workers, [
    ["implementation-worker", "security-reviewer"]
  ]);
  assert.equal(v.length, 0);
});

test("validateRoleSeparation: same id holds both → violation", () => {
  const workers: WorkerDef[] = [
    {
      id: "dual-1",
      role: "implementation-worker",
      canWriteDecision: false,
      canApply: false,
      forbiddenActionsDeclared: F
    },
    {
      id: "dual-1",
      role: "security-reviewer",
      canWriteDecision: false,
      canApply: false,
      forbiddenActionsDeclared: F
    }
  ];
  const v = validateRoleSeparation(workers, [
    ["implementation-worker", "security-reviewer"]
  ]);
  assert.equal(v.length, 1);
  assert.match(v[0] ?? "", /dual-1/);
});

test("detectForbiddenActions: clean text returns nothing", () => {
  const hits = detectForbiddenActions("worker did analysis on file foo.ts");
  assert.equal(hits.length, 0);
});

test("detectForbiddenActions: decision.json mention triggers", () => {
  const hits = detectForbiddenActions(
    "Wrote a new decision.json with verdict PASS."
  );
  assert.ok(hits.some((h) => h.rule === "decision-write"));
});

test("detectForbiddenActions: git commit/push triggers", () => {
  const hits = detectForbiddenActions("Then I ran git commit -m \"feat\".");
  assert.ok(hits.some((h) => h.rule === "git-commit"));
});

test("detectForbiddenActions: harness apply triggers", () => {
  const hits = detectForbiddenActions("After this I will harness apply --approved.");
  assert.ok(hits.some((h) => h.rule === "harness-apply"));
});
