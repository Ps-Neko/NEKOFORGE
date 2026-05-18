import { test } from "node:test";
import assert from "node:assert/strict";
import { secretFallbackRule } from "../../../src/rules/secret-fallback.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

test("secret-fallback: process.env || literal triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/config.ts", {
        addedLines: ['const key = process.env.API_KEY || "sk-test-1234";']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "critical");
});

test("secret-fallback: python os.environ.get fallback triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/c.py", {
        addedLines: ['token = os.environ.get("API_TOKEN", "fallback-12345")']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
});

test("secret-fallback: ALL_CAPS assignment with literal triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/c.ts", {
        addedLines: ['const STRIPE_KEY = "sk_test_abcd1234";']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
});

test("secret-fallback: empty fallback is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/config.ts", {
        addedLines: ['const key = process.env.API_KEY || "";']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 0);
});

test("secret-fallback: process.env without fallback is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/c.ts", { addedLines: ["const k = process.env.API_KEY;"] })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 0);
});

test("secret-fallback: assignment to non-secret name is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/c.ts", { addedLines: ['const NAME = "Alice McSomeone";'] })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 0);
});

test("secret-fallback: deleted file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/old.ts", {
        status: "deleted",
        addedLines: ['const KEY = "leakedvalue";']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 0);
});
