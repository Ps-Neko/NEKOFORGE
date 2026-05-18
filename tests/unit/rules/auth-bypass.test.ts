import { test } from "node:test";
import assert from "node:assert/strict";
import { authBypassRule } from "../../../src/rules/auth-bypass.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

test("auth-bypass: requireAuth removed without re-add triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        deletedLines: ["app.use(requireAuth());"],
        addedLines: ["app.use(noop());"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("auth-bypass: if (true) bypass triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  if (true) return next();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("auth-bypass: non-production env conditional auth triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: [
          '  if (process.env.NODE_ENV !== "production") return next();'
        ]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("auth-bypass: requireAuth removed but re-added with rename is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        deletedLines: ["app.use(requireAuth());"],
        addedLines: ["app.use(requireAuth({ strict: true }));"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.filter((f) => f.severity === "critical").length, 0);
});

test("auth-bypass: pure refactor without auth tokens is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["const ROUTES = ['/a', '/b'];"],
        deletedLines: ["const ROUTES = ['/a'];"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.length, 0);
});

test("auth-bypass: if (request.userId) is not flagged", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  if (request.userId) return next();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.length, 0);
});
