import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoDemo, seedAutoSandbox } from "../../src/cli/commands/demo.js";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGitDiff } from "../../src/utils/git.js";

test("demo auto (재생): 오프라인으로 verdict 라이브 계산", async () => {
  const cwdBefore = process.cwd();
  const r = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(r.mode, "재생");
  // 허용 목록은 실제 runGate 반환값에 맞춘다(I1: 엔진 출력에 테스트를 맞춤, verdict 위조 금지).
  assert.ok(["PASS", "REVIEW", "BLOCK", "INSUFFICIENT", "NEEDS_HUMAN_REVIEW", "PASS_WITH_WARNINGS", "INSUFFICIENT_EVIDENCE"].includes(r.verdict), `verdict=${r.verdict}`);
  assert.equal(typeof r.report, "string");
  // 재생 모드: work=0(replay adapter), review=0.2(cost-guard 예약치). 실제 AI 미호출.
  assert.equal(r.spentUsd, 0.2);
  assert.equal(process.cwd(), cwdBefore, "I2: cwd 불변");
});

test("demo auto (재생): 결정성 — 두 번 돌려도 같은 verdict/rules", async () => {
  const a = await runAutoDemo({ taskId: "TASK-001", real: false });
  const b = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(a.verdict, b.verdict);
  assert.deepEqual(a.triggeredRules, b.triggeredRules);
});

test("demo auto (재생): 출력은 '재생'으로 표기, '라이브' 주장 안 함 (I3)", async () => {
  const r = await runAutoDemo({ taskId: "TASK-001", real: false });
  assert.equal(r.mode, "재생");
});

test("demo auto (재생): 호출자 cwd 파일을 생성/변경하지 않음 (I2)", async () => {
  const probe = await mkdtemp(join(tmpdir(), "nf-demo-probe-"));
  const sentinel = join(probe, "sentinel.txt");
  await writeFile(sentinel, "untouched", "utf8");
  const before = await readdir(probe);
  const orig = process.cwd();
  process.chdir(probe);
  try {
    await runAutoDemo({ taskId: "TASK-001", real: false });
  } finally {
    process.chdir(orig);
  }
  const after = await readdir(probe);
  assert.deepEqual(after, before, "I2: 데모가 cwd 에 파일을 만들지 않음");
});

test("seedAutoSandbox: git baseline 후 파일 편집 시 readGitDiff 가 login.ts 포함 diff 를 반환 (Fix B 플럼빙)", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "nf-seed-test-"));
  try {
    await seedAutoSandbox(sandbox);

    // 베이스라인 커밋 후 파일을 변경 — claude 역할을 수동으로 시뮬레이션
    const loginPath = join(sandbox, "src", "auth", "login.ts");
    await writeFile(
      loginPath,
      [
        "export interface LoginInput { email: string; password: string }",
        "",
        "export function canLogin(input: LoginInput): boolean {",
        "  if (!input.email.includes('@')) return false;",
        "  if (input.password.length < 8) return false;",
        "  return true;",
        "}",
        "",
        "export function isLocked(attempts: number): boolean {",
        "  return attempts >= 5;",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );

    const diff = readGitDiff(sandbox);
    assert.ok(typeof diff === "string" && diff.length > 0, "readGitDiff 가 빈 문자열/null 을 반환하지 않아야 함");
    assert.ok(diff.includes("login.ts"), `diff 에 login.ts 가 포함되어야 함, 실제: ${diff.slice(0, 200)}`);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
