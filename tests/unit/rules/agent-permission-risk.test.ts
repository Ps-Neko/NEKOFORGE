import { test } from "node:test";
import assert from "node:assert/strict";
import { agentPermissionRiskRule } from "../../../src/rules/agent-permission-risk.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

test("agent-permission-risk: team.json modified triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".harness/team.json", { addedLines: ["{}"] })])
  });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("agent-permission-risk: agent-routing.json modified triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".harness/agent-routing.json", { addedLines: ["{}"] })])
  });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("agent-permission-risk: impl + security on same id triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    team: {
      agents: [
        { id: "a1", role: "implementation-agent", owns: ["TASK-1"] },
        { id: "a1", role: "security-reviewer", owns: ["TASK-1"] }
      ]
    }
  });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.ok(out.some((f) => /incompatible roles/.test(f.message)));
});

test("agent-permission-risk: harness-designer + quality-policy-designer triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    team: {
      agents: [
        { id: "a1", role: "harness-designer", owns: [] },
        { id: "a1", role: "quality-policy-designer", owns: [] }
      ]
    }
  });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("agent-permission-risk: separate ids with compatible roles is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([]),
    team: {
      agents: [
        { id: "a1", role: "implementation-agent", owns: ["TASK-1"] },
        { id: "a2", role: "security-reviewer", owns: ["TASK-1"] }
      ]
    }
  });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("agent-permission-risk: no team data and no diff is ok", async () => {
  const ctx = mockCtx({ diff: diffOf([]) });
  const out = await agentPermissionRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
