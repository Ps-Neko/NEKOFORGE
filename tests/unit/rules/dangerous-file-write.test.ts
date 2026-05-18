import { test } from "node:test";
import assert from "node:assert/strict";
import { dangerousFileWriteRule } from "../../../src/rules/dangerous-file-write.js";
import { fc, diffOf, mockCtx } from "./_helpers.js";

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
