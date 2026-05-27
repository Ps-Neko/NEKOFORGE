import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, "../../src/cli/index.ts");

test("harness demo produces a BLOCK verdict for the risky diff", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", cliPath, "demo", "--clean"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /\[verdict\] BLOCK/);
  assert.match(result.stderr, /secret-fallback/);
  assert.match(result.stderr, /\[clean\]\s+removed demo workspace/);
});

test("harness demo productivity produces source context and a task packet", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", cliPath, "demo", "productivity", "--clean"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /\[scenario\]\s+productivity/);
  assert.match(result.stderr, /\[context\]\s+\.harness\/context\.md/);
  assert.match(result.stderr, /\[packet\]\s+\.harness\/task-packets\/TASK-001\.md/);
  assert.match(result.stderr, /\[prompts\]\s+3 worker prompt\(s\)/);
  assert.match(result.stderr, /\[clean\]\s+removed demo workspace/);
});
