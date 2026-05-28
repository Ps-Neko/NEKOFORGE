import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPrompt, runDispatch } from "../../../src/workers/dispatch.js";
import { buildDeps } from "../../../src/core/stage-runner.js";
import { runInit } from "../../../src/core/init.js";
import { runWorkersInit } from "../../../src/workers/index.js";
import type { SourceMap } from "../../../src/core/source-map/index.js";

const workersJson = {
  profile: "standard",
  workers: [{ id: "impl-1", role: "implementation-worker" }]
} as never;

const FROZEN_SOURCE_MAP: SourceMap = {
  schemaVersion: "0.5",
  engineVersion: "0.5.0-alpha.5",
  generatedAt: "2026-05-28T12:00:00.000Z",
  files: ["src/index.ts"],
  languages: { TypeScript: 1 },
  packageScripts: ["test: vitest"],
  docs: ["README.md"],
  tests: ["tests/index.test.ts"],
  riskFiles: ["src/auth/login.ts"],
  relevantFiles: ["src/auth/login.ts", "tests/auth/login.test.ts"],
  limits: { maxFiles: 120, scanned: 1, truncated: false },
  framework: "next",
  packageManager: "pnpm",
  testRunner: "vitest",
  entrypoints: ["dist/index.js"],
  buildCommands: {
    build: "tsc",
    test: "vitest",
    typecheck: "tsc --noEmit",
    lint: "eslint ."
  }
};

test("renderPrompt: source-map 의 프로젝트 프로파일이 프롬프트에 주입된다", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", workersJson, {
    sourceMap: FROZEN_SOURCE_MAP
  });
  assert.match(body, /Project Profile/);
  assert.match(body, /framework: next/);
  assert.match(body, /package manager: pnpm/);
  assert.match(body, /test runner: vitest/);
  assert.match(body, /build: `tsc`/);
});

test("renderPrompt: source-map 의 relevant/risk 파일이 프롬프트에 주입된다", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", workersJson, {
    sourceMap: FROZEN_SOURCE_MAP
  });
  assert.match(body, /src\/auth\/login\.ts/);
});

test("renderPrompt: source-map 없으면 Project Profile 섹션이 만들어지지 않는다 (하위호환)", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", workersJson, {});
  assert.doesNotMatch(body, /Project Profile/);
});

test("runDispatch: .harness/source-map.json 이 있으면 자동으로 프롬프트에 주입한다", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "nekoforge-dispatch-sm-"));
  t.after(async () => rm(cwd, { recursive: true, force: true }));

  await runInit({ cwd });
  const deps = buildDeps(cwd);
  await runWorkersInit({ profile: "standard", force: true }, deps);
  await deps.artifact.writeJson("source-map.json", FROZEN_SOURCE_MAP, "source-map");

  const result = await runDispatch(
    { taskId: "TASK-001", worker: "implementation-worker" },
    deps
  );

  assert.match(result.promptBody, /Project Profile/);
  assert.match(result.promptBody, /framework: next/);
});
