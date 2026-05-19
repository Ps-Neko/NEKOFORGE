/**
 * Phase D 후속 — real adapter 의 timeout / stderr 마스킹 안전성 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCodexRealAdapter } from "../../../src/integrations/codex/real.js";
import { createClaudeReviewAdapter } from "../../../src/integrations/claude/review.js";

const LONG_SECRET = "sk_test_abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";

test("codex real: timeout produces failed status with high finding", async () => {
  const adapter = createCodexRealAdapter({
    spawn: () => ({
      status: null,
      stdout: "",
      stderr: "interrupted",
      signal: "SIGTERM",
      timedOut: true
    })
  });
  const r = await adapter.run({ rawDiff: "" });
  assert.equal(r.status, "failed");
  assert.equal(r.summary, "timeout");
});

test("codex real: stderr secrets are masked in finding detail", async () => {
  const adapter = createCodexRealAdapter({
    spawn: () => ({
      status: 1,
      stdout: "",
      stderr: `connection failed using API_KEY=${LONG_SECRET}`
    })
  });
  const r = await adapter.run({ rawDiff: "" });
  const detail = r.findings[0]?.detail ?? "";
  assert.ok(
    !detail.includes(LONG_SECRET),
    `unmasked secret leaked in detail: ${detail}`
  );
  assert.match(detail, /sk_t\*+/);
});

test("claude review: timeout produces failed status", async () => {
  const adapter = createClaudeReviewAdapter({
    spawn: () => ({
      status: null,
      stdout: "",
      stderr: "",
      signal: "SIGTERM",
      timedOut: true
    })
  });
  const r = await adapter.run({ rawDiff: "" });
  assert.equal(r.status, "failed");
});

test("claude review: stderr secrets are masked", async () => {
  const adapter = createClaudeReviewAdapter({
    spawn: () => ({
      status: 1,
      stdout: "",
      stderr: `auth failed token=${LONG_SECRET}`
    })
  });
  const r = await adapter.run({ rawDiff: "" });
  const detail = r.findings[0]?.detail ?? "";
  assert.ok(!detail.includes(LONG_SECRET));
});
