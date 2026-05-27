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
