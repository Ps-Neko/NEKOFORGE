/**
 * package.json bin alias 회귀 — Phase DX.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = resolve(__dirname, "../../package.json");

test("package.json: bin contains both nekoforge and harness aliases", async () => {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
    bin?: Record<string, string>;
  };
  assert.ok(pkg.bin, "bin field missing");
  assert.ok(pkg.bin!["nekoforge"], "nekoforge alias missing");
  assert.ok(pkg.bin!["harness"], "harness alias missing");
});

test("package.json: both aliases point to the same compiled CLI", async () => {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
    bin?: Record<string, string>;
  };
  assert.equal(pkg.bin!["nekoforge"], pkg.bin!["harness"]);
});
