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

// codex review v0.5 Finding #M1 — negation context 회피
test("detectForbiddenActions: 'do not git push' is NOT hit (negation)", () => {
  const hits = detectForbiddenActions(
    "Reminder: do not git push from worker context."
  );
  assert.equal(hits.length, 0);
});

test("detectForbiddenActions: 'decision.json 작성 금지' is NOT hit", () => {
  const hits = detectForbiddenActions(
    "본 worker 는 decision.json 작성 금지."
  );
  assert.equal(hits.length, 0);
});

test("detectForbiddenActions: 'avoid kubectl apply' is NOT hit", () => {
  const hits = detectForbiddenActions(
    "Workers must avoid kubectl apply on production."
  );
  assert.equal(hits.length, 0);
});

test("detectForbiddenActions: 'git push 는 금지' (Korean) is NOT hit", () => {
  const hits = detectForbiddenActions(
    "이 worker 는 git push 는 금지된다."
  );
  assert.equal(hits.length, 0);
});

test("detectForbiddenActions: real positive still hits ('I ran git push')", () => {
  const hits = detectForbiddenActions("I ran git push to deploy the change.");
  assert.ok(hits.some((h) => h.rule === "git-push"));
});
