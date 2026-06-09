import { test } from "node:test";
import assert from "node:assert/strict";
import { missingRateLimitRiskRule } from "../../../../src/rules/api/missing-rate-limit-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-rate-limit-risk";

// TP: auth handler file added with no rate-limit marker → warning fires.
test("missing-rate-limit-risk: new login handler without rate limit marker triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/login.ts", {
        status: "added",
        addedLines: [
          "export async function login(req, res) {",
          "  const user = await authenticate(req.body);",
          "  res.json({ token: sign(user) });",
          "}"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
  assert.equal(hits[0].file, "src/api/login.ts");
});

// TP: nested auth/ path handler (auth-controller.ts) also matches the path regex.
test("missing-rate-limit-risk: auth-prefixed handler in nested dir triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/routes/auth-controller.ts", {
        status: "added",
        addedLines: ["router.post('/auth', handleAuth);"]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
});

// TN: auth handler that DOES include a rate-limit marker → no finding.
test("missing-rate-limit-risk: login handler with express-rate-limit marker is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/login.ts", {
        status: "added",
        addedLines: [
          "import rateLimit from 'express-rate-limit';",
          "const limiter = rateLimit({ windowMs: 60000, max: 5 });",
          "router.post('/login', limiter, login);"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// TN: non-auth file (no path match) is never inspected even without a marker.
test("missing-rate-limit-risk: non-auth handler file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/products.ts", {
        status: "added",
        addedLines: ["export function listProducts() { return db.all(); }"]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Boundary: deleted auth handler must NOT fire (status === "deleted" short-circuit).
test("missing-rate-limit-risk: deleted auth handler does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/login.ts", {
        status: "deleted",
        deletedLines: ["export async function login() {}"],
        addedLines: []
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Boundary: auth handler with zero added lines (pure deletion within a modify) → no fire.
test("missing-rate-limit-risk: auth file with no added lines does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/signup.ts", {
        status: "modified",
        deletedLines: ["const x = 1;"],
        addedLines: []
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Boundary: rate-limit marker is matched case-insensitively (RATELIMIT in a comment).
test("missing-rate-limit-risk: case-insensitive rate-limit marker suppresses warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/verify.ts", {
        status: "added",
        addedLines: [
          "// guarded by RATELIMIT middleware upstream",
          "export function verify() {}"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});
