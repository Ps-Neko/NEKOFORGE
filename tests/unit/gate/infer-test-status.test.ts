/**
 * self-host #6 후속 — gate 가 post-tool hook 결과에서 testStatus 추정.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { inferTestStatusFromHooks } from "../../../src/core/gate/index.js";

test("infer: null input returns null", () => {
  assert.equal(inferTestStatusFromHooks(null), null);
});

test("infer: empty results returns null", () => {
  assert.equal(inferTestStatusFromHooks({ results: [] }), null);
});

test("infer: missing results key returns null", () => {
  assert.equal(inferTestStatusFromHooks({}), null);
});

test("infer: ok status on npm test → passed", () => {
  assert.equal(
    inferTestStatusFromHooks({
      results: [{ hookId: "post-tool/test", command: "npm test", status: "ok" }]
    }),
    "passed"
  );
});

test("infer: failed status on npm test → failed", () => {
  assert.equal(
    inferTestStatusFromHooks({
      results: [
        { hookId: "post-tool/test", command: "npm test", status: "failed" }
      ]
    }),
    "failed"
  );
});

test("infer: skipped status returns null (not inferable)", () => {
  assert.equal(
    inferTestStatusFromHooks({
      results: [
        { hookId: "post-tool/test", command: "npm test", status: "skipped" }
      ]
    }),
    null
  );
});

test("infer: yarn/pnpm/bun test commands also detected", () => {
  for (const cmd of ["yarn test", "pnpm test", "bun test", "npm run test"]) {
    assert.equal(
      inferTestStatusFromHooks({
        results: [{ command: cmd, status: "ok" }]
      }),
      "passed",
      `${cmd} should be detected`
    );
  }
});

test("infer: non-test command ignored", () => {
  assert.equal(
    inferTestStatusFromHooks({
      results: [{ command: "npm run lint", status: "ok" }]
    }),
    null
  );
});

test("infer: multiple results — first test match wins", () => {
  assert.equal(
    inferTestStatusFromHooks({
      results: [
        { command: "npm run lint", status: "ok" },
        { command: "npm test", status: "failed" },
        { command: "npm run build", status: "ok" }
      ]
    }),
    "failed"
  );
});
