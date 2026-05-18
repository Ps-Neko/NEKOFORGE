/**
 * Phase C — examples/phase-c-dogfood/eval-cases/*.json 가 eval-case schema 를 통과하는지.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createValidator } from "../../src/schemas/loader.js";

const __filename = fileURLToPath(import.meta.url);
const evalDir = resolve(__filename, "../../../examples/phase-c-dogfood/eval-cases");

test("Phase C: at least 5 eval-cases exist and pass schema", async () => {
  const files = (await readdir(evalDir)).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 5, `expected >=5 eval-cases, got ${files.length}`);
  const v = createValidator();
  for (const f of files) {
    const text = await readFile(resolve(evalDir, f), "utf8");
    const data = JSON.parse(text);
    const r = v.validate("eval-case", data);
    assert.ok(r.valid, `${f} schema errors: ${r.errors.join("; ")}`);
  }
});
