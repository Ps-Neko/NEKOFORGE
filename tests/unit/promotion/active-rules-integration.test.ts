import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectActiveRuleIds } from "../../../src/core/gate/index.js";

test("collectActiveRuleIds: promoted.json 의 rule id 가 활성 목록에 포함", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gate-"));
  await mkdir(join(dir, ".harness", "promotions"), { recursive: true });
  // 후보 모듈을 임시로 작성(실제 import 대상)
  const modPath = join(dir, "promoted-rule.mjs");
  await writeFile(modPath, `export const r = { id: "tmp-promoted", describe: "x", run: async () => [] };\n`);
  await writeFile(
    join(dir, ".harness", "promotions", "promoted.json"),
    JSON.stringify({ rules: [{ id: "tmp-promoted", modulePath: modPath, exportName: "r", promotedAt: "t", approvalHash: "h" }] })
  );
  const ids = await collectActiveRuleIds(dir);
  assert.ok(ids.includes("tmp-promoted"));
});
