import { test } from "node:test";
import assert from "node:assert/strict";
import { unsafeErrorExposureRiskRule } from "../../../../src/rules/api/unsafe-error-exposure-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "unsafe-error-exposure-risk";

// TP: res.json({ ... error.message ... }) in a catch block exposes the message → warning.
test("unsafe-error-exposure: res.json exposing error.message triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "  } catch (err) {",
          "    res.json({ ok: false, error: err.message });",
          "  }"
        ]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.ok(
    mine.some((f) => f.severity === "warning"),
    "expected a warning finding for exposed error.message"
  );
});

// TP: response.send(error.stack) — bare stack reference also matches.
test("unsafe-error-exposure: response.send exposing error.stack triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.js", {
        addedLines: ["    response.send(error.stack);"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.severity, "warning");
  assert.equal(mine[0]?.file, "src/api/handler.js");
});

// TP: status(NNN).json branch of the alternation is exercised.
test("unsafe-error-exposure: res.status(500).json with message triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.mjs", {
        addedLines: ["  res.status(500).json({ message: err.message });"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.ok(mine.some((f) => f.severity === "warning"));
});

// TN: a clean, safe error response that hides the raw message/stack → no finding.
test("unsafe-error-exposure: generic safe error response does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: [
          "  } catch (err) {",
          '    res.status(500).json({ error: "Internal Server Error" });',
          "  }"
        ]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// TN: only the message/stack token but NOT through a res/response/reply/ctx sink → no finding.
test("unsafe-error-exposure: logging the message (no response sink) does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: ["    logger.error(err.message);"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// TN: non-source file extension (.txt) is skipped even if the line matches.
test("unsafe-error-exposure: non-ts/js file is ignored", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("docs/example.txt", {
        addedLines: ["res.json({ error: err.message });"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// TN: deleted file is skipped (status === "deleted") even if its added lines match.
test("unsafe-error-exposure: deleted file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        status: "deleted",
        addedLines: ["res.json({ error: err.message });"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// Gap #6 (FP): a SUCCESS response with a bare `message` key (string literal,
// no `err.`/`error.` prefix) must NOT be flagged. Previously the bare word
// `message` matched and produced a false positive on normal success paths.
test("unsafe-error-exposure: success response with bare message key is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: ['  res.json({ message: "Account created" });']
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// Gap #6 (FP guard): status(201).json success message also must not fire.
test("unsafe-error-exposure: 201 success message key is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: ['  res.status(201).json({ ok: true, message: "Saved" });']
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 0);
});

// Gap #6 (TP guard): the real exposure `err.message` (property access) STILL fires.
test("unsafe-error-exposure: qualified err.message still fires after FP fix", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        addedLines: ["  res.json({ message: err.message });"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.severity, "warning");
});

// Boundary: the regex's [^}]* cannot cross a closing brace, so a sensitive token
// appearing AFTER a `}` within the call is NOT matched (regex-evasion / blind spot).
test("unsafe-error-exposure: token after a closing brace evades the regex (blind spot)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/handler.ts", {
        // `[^}]*` stops at the first `}`, so `stack` here is never reached by the match.
        addedLines: ["    res.json({ ok: true }, err.stack);"]
      })
    ])
  });
  const out = await unsafeErrorExposureRiskRule.run(ctx);
  const mine = out.filter((f) => f.ruleId === RULE_ID);
  assert.equal(
    mine.length,
    0,
    "regex [^}]* cannot cross `}`, so this real exposure is missed"
  );
});
