import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedCommand, runHooks } from "../../../src/hooks/runner.js";
import type { Hook } from "../../../src/hooks/types.js";

test("isAllowedCommand: internal:noop is allowed", () => {
  assert.equal(isAllowedCommand("internal:noop"), true);
});

test("isAllowedCommand: npm test is allowed", () => {
  assert.equal(isAllowedCommand("npm test"), true);
});

test("isAllowedCommand: shell metachars rejected", () => {
  assert.equal(isAllowedCommand("npm test; rm -rf /"), false);
  assert.equal(isAllowedCommand("echo $(whoami)"), false);
});

test("isAllowedCommand: unknown internal rejected", () => {
  assert.equal(isAllowedCommand("internal:evil"), false);
});

test("isAllowedCommand: unknown external rejected", () => {
  assert.equal(isAllowedCommand("curl example.com"), false);
});

test("runHooks: blocking failed command stops sequence", async () => {
  const hooks: Hook[] = [
    { id: "h1", type: "pre-tool", command: "npm test", blocking: true },
    { id: "h2", type: "pre-tool", command: "rm -rf /", blocking: true },
    { id: "h3", type: "pre-tool", command: "internal:noop" }
  ];
  const results = await runHooks(hooks, { stage: "work", cwd: "." });
  assert.equal(results.length, 2);
  assert.equal(results[1]?.status, "failed");
});

test("runHooks: filterType selects only matching", async () => {
  const hooks: Hook[] = [
    { id: "h1", type: "pre-tool", command: "internal:noop" },
    { id: "h2", type: "post-tool", command: "internal:noop" }
  ];
  const r = await runHooks(hooks, { stage: "work", cwd: "." }, { filterType: "pre-tool" });
  assert.equal(r.length, 1);
  assert.equal(r[0]?.hookId, "h1");
});
