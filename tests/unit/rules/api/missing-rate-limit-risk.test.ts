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

// Gap #4 (FN): `register` handler file (signup synonym) was not in the keyword
// list, so a registration endpoint with no rate limit slipped through.
test("missing-rate-limit-risk: register handler file without rate limit triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/register.ts", {
        status: "added",
        addedLines: [
          "export async function register(req, res) {",
          "  const user = await createUser(req.body);",
          "  res.json({ id: user.id });",
          "}"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
});

// Gap #4 (FN): an auth route added inside a domain file (users.ts) — not named
// like an auth handler — must still be detected via the route body.
test("missing-rate-limit-risk: auth route in a domain file (users.ts) triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/users.ts", {
        status: "modified",
        addedLines: [
          "router.post('/login', async (req, res) => {",
          "  const user = await authenticate(req.body.email, req.body.password);",
          "  res.json({ token: sign(user) });",
          "});"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
});

// Gap #5 (FP): `rateLimiter()` is rate-limit protection but did not match the
// old `\brateLimit\b` word boundary → the protected handler was wrongly flagged.
test("missing-rate-limit-risk: rateLimiter() marker suppresses warning (no FP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/login.ts", {
        status: "added",
        addedLines: [
          "router.post('/login', rateLimiter({ max: 5 }), async (req, res) => {",
          "  return res.json(await login(req.body));",
          "});"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});

// Gap #4 TN guard: a non-auth domain file (no auth route) must NOT fire even
// though it lives on the API surface — guards against over-firing.
test("missing-rate-limit-risk: non-auth domain file on API surface is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/users.ts", {
        status: "modified",
        addedLines: [
          "router.get('/users/:id', async (req, res) => {",
          "  res.json(await db.users.find(req.params.id));",
          "});"
        ]
      })
    ])
  });
  const out = await missingRateLimitRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 0);
});
