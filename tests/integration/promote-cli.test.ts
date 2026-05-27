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

test("submit-pack: 유효 JSON → skill-pack.json 기록", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "pack.json");
  await writeFile(packFile, JSON.stringify({ id: "ui-extra", appliesTo: "UI", guidance: ["use aria-label"] }));
  const r = run(["--workspace", ws, "promote", "submit-pack", "ui-extra", "--pack-file", packFile]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cand = JSON.parse(await readFile(join(ws, ".harness", "promotions", "ui-extra", "skill-pack.json"), "utf8")) as { id: string };
  assert.equal(cand.id, "ui-extra");
});

test("submit-pack: 잘못된 JSON(guidance 누락) → exit != 0", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "bad.json");
  await writeFile(packFile, JSON.stringify({ id: "bad", appliesTo: "UI" }));
  const r = run(["--workspace", ws, "promote", "submit-pack", "bad", "--pack-file", packFile]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /INVALID_SKILL_PACK|guidance/);
});

test("approve-pack → list-packs 에 표시", async () => {
  const ws = await mkdtemp(join(tmpdir(), "p3-"));
  await mkdir(join(ws, ".harness"), { recursive: true });
  const packFile = join(ws, "pack.json");
  await writeFile(packFile, JSON.stringify({ id: "ui-extra", appliesTo: "UI", guidance: ["g"] }));
  run(["--workspace", ws, "promote", "submit-pack", "ui-extra", "--pack-file", packFile]);
  const a = run(["--workspace", ws, "promote", "approve-pack", "ui-extra", "--approved"]);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  const l = run(["--workspace", ws, "promote", "list-packs"]);
  assert.match(l.stdout + l.stderr, /ui-extra/);
});
