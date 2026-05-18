/**
 * Phase B M1 단위 smoke 테스트.
 * 테스트 러너 자체의 동작을 확인한다 (B0-004 acceptance).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

test("test runner is alive", () => {
  assert.equal(1 + 1, 2);
});
