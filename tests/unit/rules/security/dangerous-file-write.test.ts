import { test } from "node:test";
import assert from "node:assert/strict";
import { dangerousFileWriteRule } from "../../../../src/rules/security/dangerous-file-write.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

test("dangerous-file-write: .env changed triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc(".env")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "high");
});

test("dangerous-file-write: .github/workflows file triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".github/workflows/deploy.yml")])
  });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: Dockerfile triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("Dockerfile")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: auth/ path triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/auth/jwt.ts", { addedLines: ["foo"] })])
  });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: regular src file is ok", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/utils/format.ts", { addedLines: ["foo"] })])
  });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 0);
});

test("dangerous-file-write: README is ok", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("README.md")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 0);
});

test("dangerous-file-write: .env.example is treated as dangerous (conservative)", async () => {
  const ctx = mockCtx({ diff: diffOf([fc(".env.example")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: Dockerfile.prod triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("Dockerfile.prod")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: *.Dockerfile triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("build/api.Dockerfile")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: composite action.yml triggers high", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc(".github/actions/setup/action.yml")])
  });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: .npmrc triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc(".npmrc")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: .pypirc triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc(".pypirc")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: .netrc triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc(".netrc")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: k8s manifest path triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("k8s/deployment.yaml")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: manifests/ path triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("manifests/app.yaml")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: charts/ path triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("charts/web/values.yaml")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: deploy/ path triggers high", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("deploy/prod.yaml")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 1);
});

test("dangerous-file-write: ordinary markdown is ok (TN)", async () => {
  const ctx = mockCtx({ diff: diffOf([fc("docs/guide.md")]) });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 0);
});

test("dangerous-file-write: ordinary yaml not in deploy path is ok (TN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([fc("src/config/options.yaml", { addedLines: ["a: 1"] })])
  });
  const out = await dangerousFileWriteRule.run(ctx);
  assert.equal(out.length, 0);
});
