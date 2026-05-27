import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../src/core/stage-runner.js";
import { runInit } from "../../src/core/init.js";
import { runContext } from "../../src/core/context/index.js";

test("context stage includes auto-detected source, tests, scripts, and risk files", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-context-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await mkdir(join(cwd, "src", "auth"), { recursive: true });
  await mkdir(join(cwd, "tests", "auth"), { recursive: true });
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({ scripts: { test: "node --test", typecheck: "tsc --noEmit" } }),
    "utf8"
  );
  await writeFile(join(cwd, "README.md"), "# Demo\n", "utf8");
  await writeFile(join(cwd, "src", "auth", "login.ts"), "export const ok = true;\n", "utf8");
  await writeFile(join(cwd, "tests", "auth", "login.test.ts"), "import 'node:test';\n", "utf8");

  await runInit({ cwd });
  const deps = buildDeps(cwd);
  await deps.artifact.writeMarkdown("clarify.md", "# Clarify\n");
  await runContext(deps);

  const context = await readFile(join(cwd, ".harness", "context.md"), "utf8");
  assert.match(context, /Auto-detected Project Snapshot/);
  assert.match(context, /src\/auth\/login\.ts/);
  assert.match(context, /tests\/auth\/login\.test\.ts/);
  assert.match(context, /test: node --test/);
  assert.match(context, /Risk-sensitive Files/);
});
