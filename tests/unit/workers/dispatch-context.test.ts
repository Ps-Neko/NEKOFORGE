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

const autonomousWorkers = {
  profile: "standard",
  workers: [{ id: "impl-1", role: "implementation-worker" }]
} as never;

test("renderPrompt(autonomous): 제안이 아니라 실제 파일 편집을 지시한다", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", autonomousWorkers, {
    autonomous: true
  });
  // 실제로 코드를 짜라는 지시 + 산출물 = diff
  assert.match(body, /실제로 구현하라/, "실제 구현을 지시해야 한다");
  assert.match(body, /직접 생성\/편집/, "소스 파일을 직접 생성/편집하라고 해야 한다");
  assert.match(body, /diff/, "산출물이 워킹트리 diff 임을 알려야 한다");
  // 제안서 모드의 흔적이 없어야 한다
  assert.doesNotMatch(body, /제시하라/, "더 이상 '제시하라'(propose)가 아니다");
  assert.doesNotMatch(body, /\.result\.md/, "result.md 작성 안내가 없어야 한다");
});

test("renderPrompt(autonomous): .harness 디렉터리 쓰기를 금지한다 (diff 오염 방지)", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", autonomousWorkers, {
    autonomous: true
  });
  assert.match(body, /\.harness\//, ".harness/ 를 언급해야 한다");
  assert.match(body, /오염/, ".harness 쓰기가 diff 를 오염시킨다고 경고해야 한다");
});

test("renderPrompt(autonomous): commit/push/apply 는 여전히 금지", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", autonomousWorkers, {
    autonomous: true
  });
  assert.match(body, /commit/, "commit 금지가 유지돼야 한다");
  assert.match(body, /apply/, "harness apply 금지가 유지돼야 한다");
});

test("renderPrompt(default): autonomous 아니면 result.md 안내 유지 (회귀 가드)", () => {
  const body = renderPrompt("TASK-001", "implementation-worker", autonomousWorkers, {
    spec: "## 목표\nx"
  });
  assert.match(body, /\.result\.md/, "default 모드는 result.md 안내를 그대로 둬야 한다");
});
