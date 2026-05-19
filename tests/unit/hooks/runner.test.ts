import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedCommand,
  resolveExecutable,
  runHooks
} from "../../../src/hooks/runner.js";
import type { Hook } from "../../../src/hooks/types.js";

test("resolveExecutable: non-win32 leaves command alone", () => {
  assert.equal(resolveExecutable("npm", "linux"), "npm");
  assert.equal(resolveExecutable("npx", "darwin"), "npx");
  assert.equal(resolveExecutable("yarn", "linux"), "yarn");
});

test("resolveExecutable: win32 appends .cmd to npm/npx/yarn/pnpm/deno/bun", () => {
  assert.equal(resolveExecutable("npm", "win32"), "npm.cmd");
  assert.equal(resolveExecutable("npx", "win32"), "npx.cmd");
  assert.equal(resolveExecutable("yarn", "win32"), "yarn.cmd");
  assert.equal(resolveExecutable("pnpm", "win32"), "pnpm.cmd");
  assert.equal(resolveExecutable("deno", "win32"), "deno.cmd");
  assert.equal(resolveExecutable("bun", "win32"), "bun.cmd");
});

test("resolveExecutable: win32 leaves tsc/node/git unchanged (.exe in PATH)", () => {
  assert.equal(resolveExecutable("tsc", "win32"), "tsc");
  assert.equal(resolveExecutable("node", "win32"), "node");
  assert.equal(resolveExecutable("git", "win32"), "git");
});

test("resolveExecutable: win32 preserves existing extension", () => {
  assert.equal(resolveExecutable("npm.cmd", "win32"), "npm.cmd");
  assert.equal(resolveExecutable("custom.exe", "win32"), "custom.exe");
  assert.equal(resolveExecutable("script.bat", "win32"), "script.bat");
});

test("isAllowedCommand: internal:noop is allowed", () => {
  assert.equal(isAllowedCommand("internal:noop"), true);
});

test("isAllowedCommand: npm test is allowed", () => {
  assert.equal(isAllowedCommand("npm test"), true);
});

test("isAllowedCommand: shell metachars rejected", () => {
  assert.equal(isAllowedCommand("npm test; rm -rf /"), false);
  assert.equal(isAllowedCommand("echo $(whoami)"), false);
});

test("isAllowedCommand: unknown internal rejected", () => {
  assert.equal(isAllowedCommand("internal:evil"), false);
});

test("isAllowedCommand: unknown external rejected", () => {
  assert.equal(isAllowedCommand("curl example.com"), false);
});

test("runHooks: blocking whitelist-violation stops sequence", async () => {
  // 외부 spawn 회피를 위해 internal:noop 만 사용. rm -rf 는 whitelist 외라
  // executor 호출 전 단계에서 failed.
  const hooks: Hook[] = [
    { id: "h1", type: "pre-tool", command: "internal:noop", blocking: true },
    { id: "h2", type: "pre-tool", command: "rm -rf /", blocking: true },
    { id: "h3", type: "pre-tool", command: "internal:noop" }
  ];
  const results = await runHooks(hooks, { stage: "work", cwd: "." });
  assert.equal(results.length, 2);
  assert.equal(results[1]?.status, "failed");
});

test("runHooks: filterType selects only matching", async () => {
  const hooks: Hook[] = [
    { id: "h1", type: "pre-tool", command: "internal:noop" },
    { id: "h2", type: "post-tool", command: "internal:noop" }
  ];
  const r = await runHooks(hooks, { stage: "work", cwd: "." }, { filterType: "pre-tool" });
  assert.equal(r.length, 1);
  assert.equal(r[0]?.hookId, "h1");
});
