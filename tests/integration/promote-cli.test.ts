import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cli = join(dirname(fileURLToPath(import.meta.url)), "../../src/cli/index.ts");
function run(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8" });
}

test("promote --help 는 6개 서브커맨드를 노출", () => {
  const r = run(["promote", "--help"]);
  assert.equal(r.status, 0);
  for (const sub of ["submit", "trial", "report", "approve", "reject", "list"]) {
    assert.match(r.stdout + r.stderr, new RegExp(sub));
  }
});
