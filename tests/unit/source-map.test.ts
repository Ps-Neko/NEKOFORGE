import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDeps } from "../../src/core/stage-runner.js";
import { runInit } from "../../src/core/init.js";
import { runSourceMap, type SourceMap } from "../../src/core/source-map/index.js";

const FROZEN_CLOCK = () => new Date("2026-05-28T12:00:00.000Z");

async function setupProject(prefix: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(cwd, "src", "auth"), { recursive: true });
  await mkdir(join(cwd, "tests", "auth"), { recursive: true });
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({ scripts: { test: "node --test", typecheck: "tsc --noEmit" } }),
    "utf8"
  );
  await writeFile(join(cwd, "README.md"), "# Demo\n", "utf8");
  await writeFile(join(cwd, "src", "auth", "login.ts"), "export const ok = true;\n", "utf8");
  await writeFile(
    join(cwd, "tests", "auth", "login.test.ts"),
    "import 'node:test';\n",
    "utf8"
  );
  await runInit({ cwd });
  return cwd;
}

test("runSourceMap writes machine-readable JSON artifact", async (t) => {
  const cwd = await setupProject("nekoforge-source-map-json-");
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const result = await runSourceMap(deps);

  assert.equal(result.jsonPath, ".harness/source-map.json");
  assert.equal(result.markdownPath, ".harness/source-map.md");

  const raw = await readFile(join(cwd, ".harness", "source-map.json"), "utf8");
  const parsed = JSON.parse(raw) as SourceMap;
  assert.equal(parsed.schemaVersion, "0.5");
  assert.equal(parsed.generatedAt, "2026-05-28T12:00:00.000Z");
  assert.ok(parsed.engineVersion.length > 0);
  assert.ok(parsed.files.includes("src/auth/login.ts"));
  assert.ok(parsed.tests.includes("tests/auth/login.test.ts"));
  assert.ok(parsed.docs.includes("README.md"));
  assert.deepEqual(
    parsed.packageScripts.sort(),
    ["test: node --test", "typecheck: tsc --noEmit"].sort()
  );
  assert.equal(parsed.languages.TypeScript, 2);
  assert.equal(parsed.limits.maxFiles, 120);
  assert.ok(parsed.limits.scanned >= 4);
  assert.equal(parsed.limits.truncated, false);
});

test("runSourceMap writes a human-readable markdown sibling", async (t) => {
  const cwd = await setupProject("nekoforge-source-map-md-");
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  await runSourceMap(deps);

  const md = await readFile(join(cwd, ".harness", "source-map.md"), "utf8");
  assert.match(md, /# Source Map/);
  assert.match(md, /Generated: 2026-05-28T12:00:00\.000Z/);
  assert.match(md, /## Source Files/);
  assert.match(md, /src\/auth\/login\.ts/);
  assert.match(md, /## Package Scripts/);
  assert.match(md, /test: node --test/);
});

test("runSourceMap ranks relevant files when task hints are provided", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-source-map-relevant-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await mkdir(join(cwd, "src", "auth"), { recursive: true });
  await mkdir(join(cwd, "src", "billing"), { recursive: true });
  await writeFile(join(cwd, "src", "auth", "login.ts"), "export const ok = true;\n", "utf8");
  await writeFile(
    join(cwd, "src", "billing", "invoice.ts"),
    "export const paid = true;\n",
    "utf8"
  );
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const result = await runSourceMap(deps, {
    hints: "Add login lockout after failed attempts"
  });

  assert.ok(result.sourceMap.relevantFiles.includes("src/auth/login.ts"));
  assert.ok(!result.sourceMap.relevantFiles.includes("src/billing/invoice.ts"));
});

test("runSourceMap validates the JSON against the schema", async (t) => {
  const cwd = await setupProject("nekoforge-source-map-schema-");
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  await runSourceMap(deps);

  const parsed = await deps.artifact.readJson<SourceMap>("source-map.json", "source-map");
  assert.ok(parsed);
  assert.equal(parsed.schemaVersion, "0.5");
});

test("runSourceMap preserves user-provided context", async (t) => {
  const cwd = await setupProject("nekoforge-source-map-user-");
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const result = await runSourceMap(deps, { userContext: "manual note" });
  assert.equal(result.sourceMap.userContext, "manual note");
});

test("runSourceMap detects entrypoints from package.json main/bin", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-sm-entrypoint-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      main: "dist/index.js",
      bin: { "my-cli": "dist/cli.js" }
    }),
    "utf8"
  );
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const { sourceMap } = await runSourceMap(deps);

  assert.ok(sourceMap.entrypoints, "should include entrypoints field");
  assert.ok(sourceMap.entrypoints.includes("dist/index.js"));
  assert.ok(sourceMap.entrypoints.includes("dist/cli.js"));
});

test("runSourceMap detects framework from dependencies", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-sm-framework-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      dependencies: { next: "^14.0.0", react: "^18.0.0" }
    }),
    "utf8"
  );
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const { sourceMap } = await runSourceMap(deps);

  assert.equal(sourceMap.framework, "next");
});

test("runSourceMap detects package manager from lock file", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-sm-pm-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await writeFile(join(cwd, "package.json"), "{}", "utf8");
  await writeFile(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: 5.4\n", "utf8");
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const { sourceMap } = await runSourceMap(deps);

  assert.equal(sourceMap.packageManager, "pnpm");
});

test("runSourceMap detects test runner from devDependencies", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-sm-runner-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      devDependencies: { vitest: "^1.0.0" }
    }),
    "utf8"
  );
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const { sourceMap } = await runSourceMap(deps);

  assert.equal(sourceMap.testRunner, "vitest");
});

test("runSourceMap groups package scripts into buildCommands.{build,test,typecheck,lint}", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-sm-cmds-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      scripts: {
        build: "tsc -p .",
        test: "node --test",
        typecheck: "tsc --noEmit",
        lint: "eslint .",
        start: "node dist/index.js"
      }
    }),
    "utf8"
  );
  await runInit({ cwd });

  const deps = { ...buildDeps(cwd), clock: FROZEN_CLOCK };
  const { sourceMap } = await runSourceMap(deps);

  assert.ok(sourceMap.buildCommands, "should include buildCommands");
  assert.equal(sourceMap.buildCommands.build, "tsc -p .");
  assert.equal(sourceMap.buildCommands.test, "node --test");
  assert.equal(sourceMap.buildCommands.typecheck, "tsc --noEmit");
  assert.equal(sourceMap.buildCommands.lint, "eslint .");
});
