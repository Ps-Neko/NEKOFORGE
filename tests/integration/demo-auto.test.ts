import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoDemo } from "../../src/cli/commands/demo.js";

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
