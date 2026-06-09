import { test } from "node:test";
import assert from "node:assert/strict";
import { authBypassRule } from "../../../../src/rules/security/auth-bypass.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

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

test("auth-bypass: AST catches if (1 === 1) bypass (regex misses)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  if (1 === 1) return next();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("auth-bypass: AST catches if (!false) bypass (regex misses)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  if (!false) return next();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("auth-bypass: legitimate constant-false guard is not flagged", async () => {
  // if (false) is dead code, not an auth *bypass* — must not trigger.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  if (1 === 2) return next();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.length, 0);
});

test("auth-bypass: AST catches constant-true ternary bypass (regex misses)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  const r = true ? next() : requireAuth();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(
    out.some((f) => f.severity === "critical"),
    "constant-true ternary should be flagged"
  );
});

test("auth-bypass: constant-false ternary is not flagged (TN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  const r = (1 === 2) ? next() : requireAuth();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.length, 0);
});

test("auth-bypass: non-static ternary is not flagged (TN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        addedLines: ["  const r = isAdmin ? next() : requireAuth();"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.length, 0);
});

test("auth-bypass: token removal masked by comment re-adding token is still flagged", async () => {
  // Real requireAuth( deleted; "added" lines only re-mention it in a comment.
  // Comment/string-only added lines must not offset the removed count.
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        deletedLines: ["app.use(requireAuth());"],
        addedLines: [
          "// requireAuth() was here, removed intentionally",
          "app.use(noop());"
        ]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(
    out.some((f) => f.severity === "critical"),
    "comment-masked auth removal should still be flagged"
  );
});

test("auth-bypass: token genuinely re-added in real code is not flagged (TN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/route.ts", {
        deletedLines: ["app.use(requireAuth());"],
        addedLines: [
          "// moved auth setup below",
          "app.use(requireAuth({ strict: true }));"
        ]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.equal(out.filter((f) => f.severity === "critical").length, 0);
});
