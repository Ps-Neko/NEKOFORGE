import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

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

async function wsWithEvalCase(kind: string): Promise<{ ws: string; ecId: string }> {
  const ws = await mkdtemp(join(tmpdir(), "p2-"));
  await mkdir(join(ws, ".harness", "eval-cases"), { recursive: true });
  const ecId = "ec-test-1";
  await writeFile(
    join(ws, ".harness", "eval-cases", `${ecId}.json`),
    JSON.stringify({ id: ecId, kind, summary: "test case" })
  );
  return { ws, ecId };
}
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("submit --experience: 유효 eval-case 면 candidate.json 에 기록", async () => {
  const { ws, ecId } = await wsWithEvalCase("missed_risk");
  const r = run([
    "--workspace", ws, "promote", "submit", "r1",
    "--module", join(repoRoot, "src/rules/promotion-candidates/todo-comment-risk.ts"),
    "--export", "todoCommentRiskRule",
    "--fixtures", join(repoRoot, "fixtures"),
    "--experience", ecId
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cand = JSON.parse(await readFile(join(ws, ".harness", "promotions", "r1", "candidate.json"), "utf8")) as { experiences?: string[] };
  assert.deepEqual(cand.experiences, [ecId]);
});

test("submit --experience: 없는 eval-case 면 exit != 0", async () => {
  const { ws } = await wsWithEvalCase("missed_risk");
  const r = run([
    "--workspace", ws, "promote", "submit", "r2",
    "--module", join(repoRoot, "src/rules/promotion-candidates/todo-comment-risk.ts"),
    "--export", "todoCommentRiskRule",
    "--fixtures", join(repoRoot, "fixtures"),
    "--experience", "does-not-exist"
  ]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /INVALID_EXPERIENCE|없음/);
});
