/**
 * 3번 — --no-review-adapter 가 검증을 무시하면 reviewStatus 도 not_run 으로
 * 강제해야 한다. 그래야 ⓐ 강등(PASS_WITH_WARNINGS) + strict 차단이 작동하고,
 * "검증 무시"가 verdict 에 가시화된다(기존엔 codexRaw.status 가 그대로 새던 우회).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReviewStatus } from "../../../src/core/gate/index.js";

test("resolveReviewStatus: --no-review-adapter forces not_run even if codex said passed", () => {
  assert.equal(resolveReviewStatus(true, "passed"), "not_run");
  assert.equal(resolveReviewStatus(true, "warnings"), "not_run");
});

test("resolveReviewStatus: passes codex status through when adapter active", () => {
  assert.equal(resolveReviewStatus(false, "passed"), "passed");
  assert.equal(resolveReviewStatus(false, "warnings"), "warnings");
  assert.equal(resolveReviewStatus(false, "failed"), "failed");
});

test("resolveReviewStatus: undefined/unknown codex status → not_run", () => {
  assert.equal(resolveReviewStatus(false, undefined), "not_run");
  assert.equal(resolveReviewStatus(false, "bogus"), "not_run");
});
