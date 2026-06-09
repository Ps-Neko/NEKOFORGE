import { test } from "node:test";
import assert from "node:assert/strict";
import { staleCountRiskRule } from "../../../../src/rules/docs/stale-count-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

// 룰 실제 동작(소스 확인):
//   - 경로 휴리스틱만 본다 (라인 내용/수치는 무시).
//   - TEST_FILE_RE: /(^|\/)(tests?|spec|__tests__)\/.*\.(test|spec)\./
//   - FIXTURE_FILE_RE: /(^|\/)fixtures\//
//   - README_RE: /(^|\/)README\.md$/i
//   - (tests OR fixtures 변경) AND (README 미변경) 이면 발화.
//   - severity 는 "info" (헤더 주석은 "warning"이라 적었지만 코드는 info 반환).

// ── TP: 발화해야 하는 입력 ───────────────────────────────────────────

test("stale-count-risk: test 파일 추가 + README 미변경 → info 발화 (TP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/unit/foo.test.ts", {
        status: "added",
        addedLines: ["test('new', () => {});"]
      })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.ok(out.some((f) => f.severity === "info"));
  assert.ok(
    out.some((f) => f.ruleId === "stale-count-risk" && f.severity === "info")
  );
});

test("stale-count-risk: fixtures 파일 변경 + README 미변경 → info 발화 (TP)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/core/fixtures/sample.json", {
        status: "modified",
        addedLines: ["{}"]
      })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.severity, "info");
  assert.equal(
    out[0]!.message,
    "tests/fixtures changed but README.md untouched (count drift risk)"
  );
});

// ── TN: 발화하면 안 되는 입력 ────────────────────────────────────────

test("stale-count-risk: test 파일 + README 동반 변경 → 미발화 (TN, 가드)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/unit/foo.test.ts", { status: "added", addedLines: ["x"] }),
      fc("README.md", {
        status: "modified",
        addedLines: ["- 245 tests"],
        deletedLines: ["- 244 tests"]
      })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("stale-count-risk: tests/fixtures 무관한 src 변경만 → 미발화 (TN)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/rules/docs/other.ts", {
        status: "modified",
        addedLines: ["export const x = 1;"]
      })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// ── 경계 케이스 ─────────────────────────────────────────────────────

test("stale-count-risk: 빈 diff → 미발화 (경계)", async () => {
  const ctx = mockCtx({ diff: diffOf([]) });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("stale-count-risk: 소문자 readme.md 도 README 로 인정 (대소문자 무시, 가드 경계)", async () => {
  // README_RE 는 /i 플래그 → readme.md 동반 변경 시 발화 억제되어야 함.
  const ctx = mockCtx({
    diff: diffOf([
      fc("fixtures/data.json", { status: "added", addedLines: ["{}"] }),
      fc("docs/readme.md", { status: "modified", addedLines: ["count: 5"] })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

test("stale-count-risk: '.test.' 아닌 일반 tests/ 파일은 미발화 (regex 회피 경계)", async () => {
  // tests/ 하위라도 *.test./*.spec. 패턴이 아니면 TEST_FILE_RE 불일치.
  const ctx = mockCtx({
    diff: diffOf([
      fc("tests/unit/_helpers.ts", {
        status: "modified",
        addedLines: ["export const helper = 1;"]
      })
    ])
  });
  const out = await staleCountRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
