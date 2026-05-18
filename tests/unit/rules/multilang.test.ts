/**
 * Phase E — Python/Go 휴리스틱 확장 단위 테스트.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { secretFallbackRule } from "../../../src/rules/secret-fallback.js";
import { authBypassRule } from "../../../src/rules/auth-bypass.js";
import { testDeletionRule } from "../../../src/rules/test-deletion.js";
import { noTestRiskRule } from "../../../src/rules/no-test-risk.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

// ===== secret-fallback (Python / Go) =====================================

test("secret-fallback (PY): os.getenv with literal fallback triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("app/conf.py", {
        addedLines: ['key = os.getenv("API_KEY", "fallback-12345")']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "critical");
});

test("secret-fallback (GO): GetEnvOrDefault with literal fallback triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("cmd/main.go", {
        addedLines: ['key := GetEnvOrDefault("API_KEY", "fallback-abcdef")']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
});

test("secret-fallback (GO): const KEY literal still triggers via ALL_CAPS rule", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("cmd/main.go", {
        addedLines: ['const API_KEY = "sk_live_abcd1234"']
      })
    ])
  });
  const out = await secretFallbackRule.run(ctx);
  assert.equal(out.length, 1);
});

// ===== auth-bypass (Python / Go) ===========================================

test("auth-bypass (PY): @login_required removed without replacement", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("app/views.py", {
        deletedLines: ["@login_required", "def view(req):"],
        addedLines: ["def view(req):"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => /login_required/.test(f.message)));
});

test("auth-bypass (PY): 'if True:' bypass triggers", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("app/views.py", { addedLines: ["    if True:", "        return view(req)"] })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.length >= 1);
});

test("auth-bypass (GO): RequireAuth removed", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("internal/server/router.go", {
        deletedLines: ["r.Use(RequireAuth())"],
        addedLines: ["// auth check removed for now"]
      })
    ])
  });
  const out = await authBypassRule.run(ctx);
  assert.ok(out.some((f) => /RequireAuth/.test(f.message)));
});

// ===== test-deletion (Python / Go) =========================================

test("test-deletion (PY): test_user.py deleted triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("tests/test_user.py", { status: "deleted" })])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("test-deletion (PY): @pytest.mark.skip added triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/test_user.py", {
        addedLines: ['@pytest.mark.skip(reason="wip")']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

test("test-deletion (GO): foo_test.go deleted triggers critical", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("pkg/foo_test.go", { status: "deleted" })])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "critical"));
});

test("test-deletion (GO): t.Skip added triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("pkg/foo_test.go", {
        addedLines: ['\tt.Skip("flaky for now")']
      })
    ])
  });
  const out = await testDeletionRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "high"));
});

// ===== no-test-risk (Python / Go) =========================================

test("no-test-risk (PY): app/ changed, no tests → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("app/views.py", { addedLines: ["def view(): pass"] })])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "warning");
});

test("no-test-risk (GO): internal/ changed, no tests → warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("internal/server/handler.go", {
        addedLines: ["func Handle() {}"]
      })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 1);
});

test("no-test-risk (PY): with matching test file → ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("app/views.py", { addedLines: ["def view(): pass"] }),
      fc("tests/test_views.py", { addedLines: ["def test_view(): pass"] })
    ])
  });
  const out = await noTestRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
