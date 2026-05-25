import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPrompt } from "../../../src/workers/dispatch.js";

test("renderPrompt: SPEC/PLAN 맥락이 프롬프트 본문에 주입된다", () => {
  const workers = { profile: "standard", workers: [{ id: "impl-1", role: "implementation-worker" }] } as never;
  const body = renderPrompt("TASK-001", "implementation-worker", workers, {
    spec: "## 목표\n로그인 잠금 기능",
    plan: "- TASK-001: lockout 구현"
  });
  assert.match(body, /로그인 잠금 기능/);
  assert.match(body, /lockout 구현/);
});

test("renderPrompt: context 없으면 기존처럼 템플릿만 (하위호환)", () => {
  const workers = { profile: "standard", workers: [{ id: "impl-1", role: "implementation-worker" }] } as never;
  const body = renderPrompt("TASK-001", "implementation-worker", workers);
  assert.match(body, /최소 동작|minimal viable|구현안/);
});
