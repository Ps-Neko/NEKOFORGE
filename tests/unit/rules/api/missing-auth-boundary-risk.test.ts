import { test } from "node:test";
import assert from "node:assert/strict";
import { missingAuthBoundaryRiskRule } from "../../../../src/rules/api/missing-auth-boundary-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-auth-boundary-risk";

// TP: new API handler under src/api/ with no auth marker and no public hint → warning.
test("missing-auth-boundary-risk: new handler without auth marker triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/orders.ts", {
        status: "added",
        addedLines: [
          "export async function handler(req, res) {",
          "  return res.json(await db.orders.all());",
          "}"
        ]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
  assert.equal(hits[0].file, "src/api/orders.ts");
});

// TP variant: express-style router.get handler also fires (HANDLER_RE matches router.\w+().
test("missing-auth-boundary-risk: router.get handler without auth triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/routes/users.js", {
        status: "added",
        addedLines: ["router.get('/me', (req, res) => res.json(req.user));"]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TN: handler that includes an explicit auth middleware marker → no finding.
test("missing-auth-boundary-risk: handler guarded by requireAuth() is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/orders.ts", {
        status: "added",
        addedLines: [
          "export async function handler(req, res) {",
          "  await requireAuth(req);",
          "  return res.json(await db.orders.all());",
          "}"
        ]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: path is outside the API surface (src/lib/) → rule never inspects it.
test("missing-auth-boundary-risk: non-API path is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/lib/orders.ts", {
        status: "added",
        addedLines: ["export async function handler(req, res) { return res.end(); }"]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: PUBLIC_HINT_RE is matched against the *path*. A webhook path is
// intentionally exempt even with no auth marker.
test("missing-auth-boundary-risk: webhook path hint suppresses the warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/webhook-stripe.ts", {
        status: "added",
        addedLines: ["export async function handler(req, res) { return res.end(); }"]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: deleted files are skipped even if they would otherwise match.
test("missing-auth-boundary-risk: deleted handler file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/orders.ts", {
        status: "deleted",
        addedLines: ["export async function handler(req, res) { return res.end(); }"]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: no handler signature in the added lines → not flagged (pure constant edit).
test("missing-auth-boundary-risk: API-path change with no handler signature is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/orders.ts", {
        status: "modified",
        addedLines: ["const PAGE_SIZE = 50;"]
      })
    ])
  });
  const out = await missingAuthBoundaryRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
