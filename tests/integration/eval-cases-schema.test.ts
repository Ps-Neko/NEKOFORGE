/**
 * Phase C/D — examples 하위 모든 eval-cases JSON 이 eval-case schema 를 통과하는지.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createValidator } from "../../src/schemas/loader.js";

const __filename = fileURLToPath(import.meta.url);
const examplesRoot = resolve(__filename, "../../../examples");

async function findEvalCaseDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  const top = await readdir(root, { withFileTypes: true });
  for (const ent of top) {
    if (!ent.isDirectory()) continue;
    const subPath = join(root, ent.name, "eval-cases");
    try {
      const s = await stat(subPath);
      if (s.isDirectory()) out.push(subPath);
    } catch {
      // no eval-cases subdir — skip
    }
  }
  return out;
}

test("eval-cases (all examples): pass eval-case schema, ≥9 total", async () => {
  const dirs = await findEvalCaseDirs(examplesRoot);
  assert.ok(dirs.length >= 1, "no eval-cases directory found under examples/");

  const v = createValidator();
  let total = 0;
  for (const d of dirs) {
    const files = (await readdir(d)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const text = await readFile(resolve(d, f), "utf8");
      const data = JSON.parse(text);
      const r = v.validate("eval-case", data);
      assert.ok(r.valid, `${d}/${f} schema errors: ${r.errors.join("; ")}`);
      total += 1;
    }
  }
  assert.ok(total >= 9, `expected ≥9 eval-cases total, got ${total}`);
});
