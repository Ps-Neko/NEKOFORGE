import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeReviewAdapter } from "../../../src/integrations/claude/review.js";

test("claude review: parses JSON output", async () => {
  const a = createClaudeReviewAdapter({
    spawn: () => ({
      status: 0,
      stdout: JSON.stringify({
        status: "passed",
        findings: [],
        summary: "ok"
      }),
      stderr: ""
    })
  });
  const r = await a.run({ rawDiff: "diff" });
  assert.equal(r.adapterId, "claude");
  assert.equal(r.status, "passed");
});

test("claude review: probe fail + ANTHROPIC_API_KEY absent → available false", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const a = createClaudeReviewAdapter({
    spawn: () => ({ status: 127, stdout: "", stderr: "" }),
    requireApiKey: true
  });
  assert.equal(await a.available(), false);
});

test("claude review: probe fail + ANTHROPIC_API_KEY set → available true (when requireApiKey)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-for-availability";
  const a = createClaudeReviewAdapter({
    spawn: () => ({ status: 127, stdout: "", stderr: "" }),
    requireApiKey: true
  });
  assert.equal(await a.available(), true);
  delete process.env.ANTHROPIC_API_KEY;
});
