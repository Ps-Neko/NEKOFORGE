import { test } from "node:test";
import assert from "node:assert/strict";
import { missingInputValidationRiskRule } from "../../../../src/rules/api/missing-input-validation-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-input-validation-risk";

// TP: req.body used directly with no validation call → warning finding.
test("missing-input-validation: direct req.body without validation triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "app.post('/users', (req, res) => {",
          "  const name = req.body.name;",
          "  db.insert(name);",
          "});"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  const finding = out.find(
    (f) => f.ruleId === RULE_ID && f.severity === "warning"
  );
  assert.ok(finding, "expected a warning finding for unvalidated req.body");
  // 2nd added line (index 1) is where req.body first appears → line === 2.
  assert.equal(finding?.line, 2);
  assert.equal(finding?.file, "src/api/handler.ts");
});

// TP variant: req.query and req.params also count as direct access.
test("missing-input-validation: req.query without validation triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/search.js", {
        addedLines: ["  const term = req.query.q;"]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 1);
  assert.equal(out[0]?.severity, "warning");
});

// TN: validation present (zod .parse) → rule does NOT fire.
test("missing-input-validation: req.body guarded by zod schema does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "const schema = z.object({ name: z.string() });",
          "const parsed = schema.parse(req.body);",
          "db.insert(parsed.name);"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: no direct req.body/query/params reference at all → no finding.
test("missing-input-validation: clean handler with no direct req access is silent", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "const ROUTES = ['/a', '/b'];",
          "function noop() { return true; }"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: negative lookahead — `req.bodyParser` is an identifier, not direct
// body access, so the rule must NOT fire (next char after `body` is a letter).
test("missing-input-validation: req.bodyParser identifier is not flagged (lookahead)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/middleware.ts", {
        addedLines: ["app.use(req.bodyParser());"]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: non-code file extension is skipped even with the risky pattern.
test("missing-input-validation: non js/ts file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/example.md", {
        addedLines: ["const name = req.body.name;"]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Boundary: deleted file is skipped even if its added-lines snapshot matches.
test("missing-input-validation: deleted file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/old.ts", {
        status: "deleted",
        addedLines: ["const name = req.body.name;"]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Gap #3 (FN): `JSON.parse(...)` is NOT schema validation. Previously the bare
// `.parse(` token suppressed the warning, so unvalidated req.body slipped through.
test("missing-input-validation: JSON.parse does not count as validation (still warns)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "app.post('/users', (req, res) => {",
          "  const data = JSON.parse(req.body.payload);",
          "  db.insert(data);",
          "});"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  const hits = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "warning");
});

// Gap #3 (FN): Date.parse(...) is likewise a standard parser, not validation.
test("missing-input-validation: Date.parse does not count as validation (still warns)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "  const when = Date.parse(req.query.when);",
          "  schedule(when);"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 1);
});

// Gap #3 (TN guard): a real schema-variable `.parse(req.body)` STILL counts as
// validation (must not regress the documented zod path).
test("missing-input-validation: schema-variable .parse still suppresses", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "const parsed = userSchema.parse(req.body);",
          "db.insert(parsed);"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// Gap #3 (TN guard): zod `.safeParse(req.body)` also counts as validation.
test("missing-input-validation: zod safeParse suppresses", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "const result = schema.safeParse(req.body);",
          "if (!result.success) return res.status(400).end();"
        ]
      })
    ])
  });
  const out = await missingInputValidationRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
