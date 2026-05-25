import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkerTimeoutMs } from "../../../src/cli/commands/auto.js";

test("parseWorkerTimeoutMs: 초를 ms 로 변환한다", () => {
  assert.equal(parseWorkerTimeoutMs("600"), 600_000);
  assert.equal(parseWorkerTimeoutMs("90"), 90_000);
});

test("parseWorkerTimeoutMs: 미지정이면 기본 600초(600000ms)", () => {
  assert.equal(parseWorkerTimeoutMs(undefined), 600_000);
});

test("parseWorkerTimeoutMs: 잘못된 값/0 이하는 기본값 (초→ms 누락·오입력 footgun 방지)", () => {
  assert.equal(parseWorkerTimeoutMs("abc"), 600_000);
  assert.equal(parseWorkerTimeoutMs("0"), 600_000);
  assert.equal(parseWorkerTimeoutMs("-5"), 600_000);
});
