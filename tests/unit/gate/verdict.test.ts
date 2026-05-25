/**
 * computeVerdict — 핵심 verdict 산출 단위 테스트.
 *
 * ⓐ 미검증=미통과: 독립 review 가 실행되지 않았거나(not_run) 실패했을(failed) 때
 * 깨끗한 결과를 그대로 PASS 로 묻어버리지 않고 최소 PASS_WITH_WARNINGS 로 가시화한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVerdict, gateStrictExitCode } from "../../../src/core/gate/verdict.js";

test("verdict: clean diff + review passed → PASS", () => {
  const out = computeVerdict({
    findings: [],
    testStatus: "passed",
    reviewStatus: "passed"
  });
  assert.equal(out.verdict, "PASS");
});

test("verdict: review not_run downgrades clean result to PASS_WITH_WARNINGS", () => {
  const out = computeVerdict({
    findings: [],
    testStatus: "passed",
    reviewStatus: "not_run"
  });
  assert.equal(out.verdict, "PASS_WITH_WARNINGS");
  assert.ok(
    out.reasons.some((r) => /no independent review/i.test(r)),
    `expected a 'no independent review' reason, got: ${JSON.stringify(out.reasons)}`
  );
});

test("verdict: review failed downgrades clean result to PASS_WITH_WARNINGS", () => {
  const out = computeVerdict({
    findings: [],
    testStatus: "passed",
    reviewStatus: "failed"
  });
  assert.equal(out.verdict, "PASS_WITH_WARNINGS");
});

test("verdict: critical finding still BLOCKs even when review not_run", () => {
  const out = computeVerdict({
    findings: [{ ruleId: "auth-bypass", severity: "critical", message: "x" }],
    testStatus: "passed",
    reviewStatus: "not_run"
  });
  assert.equal(out.verdict, "BLOCK");
});

test("verdict: high finding still NEEDS_HUMAN_REVIEW when review not_run", () => {
  const out = computeVerdict({
    findings: [{ ruleId: "dangerous-file-write", severity: "high", message: "x" }],
    testStatus: "passed",
    reviewStatus: "not_run"
  });
  assert.equal(out.verdict, "NEEDS_HUMAN_REVIEW");
});

// ⓑ gate --strict exit code 매핑. apply 와 통일(BLOCK/INSUFFICIENT=4, NEEDS_HUMAN=3).
// strict 에서는 PASS_WITH_WARNINGS 도 사람이 봐야 통과하므로 차단(3).
test("strict exit: PASS → 0", () => {
  assert.equal(gateStrictExitCode("PASS"), 0);
});

test("strict exit: PASS_WITH_WARNINGS → 3 (strict blocks warnings)", () => {
  assert.equal(gateStrictExitCode("PASS_WITH_WARNINGS"), 3);
});

test("strict exit: NEEDS_HUMAN_REVIEW → 3", () => {
  assert.equal(gateStrictExitCode("NEEDS_HUMAN_REVIEW"), 3);
});

test("strict exit: BLOCK → 4", () => {
  assert.equal(gateStrictExitCode("BLOCK"), 4);
});

test("strict exit: INSUFFICIENT_EVIDENCE → 4", () => {
  assert.equal(gateStrictExitCode("INSUFFICIENT_EVIDENCE"), 4);
});
