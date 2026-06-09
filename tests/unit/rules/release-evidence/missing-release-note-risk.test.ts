import { test } from "node:test";
import assert from "node:assert/strict";
import { missingReleaseNoteRiskRule } from "../../../../src/rules/release-evidence/missing-release-note-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-release-note-risk";

// TP 1: schema 파일 변경 + RELEASE-NOTES 미갱신 → warning 발화
test("missing-release-note-risk: schema change without RELEASE-NOTES triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({ id: z.string() });"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TP 2: package.json version 변경 + RELEASE-NOTES 미갱신 → warning 발화
test("missing-release-note-risk: package.json version bump without RELEASE-NOTES triggers warning", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "version": "1.2.0",'],
        deletedLines: ['  "version": "1.1.0",']
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.ok(out.some((f) => f.ruleId === RULE_ID && f.severity === "warning"));
});

// TN 1: schema 변경이지만 RELEASE-NOTES.md 도 함께 갱신 → 미발화
test("missing-release-note-risk: schema change WITH RELEASE-NOTES update does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({ id: z.string() });"]
      }),
      fc("RELEASE-NOTES.md", {
        addedLines: ["## 1.2.0", "- breaking: userSchema requires id"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN 2: schema/version 무관한 일반 소스 변경 → 미발화
test("missing-release-note-risk: unrelated source change does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/utils/format.ts", {
        addedLines: ["export const greet = (n: string) => `hi ${n}`;"],
        deletedLines: ["export const greet = (n: string) => `hello ${n}`;"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// 경계 1: package.json 변경이지만 version 라인을 추가하지 않음(다른 필드만) → 미발화
test("missing-release-note-risk: package.json change without version line does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "description": "updated description",']
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// 경계 2: schema 변경 + 대소문자 다른 release-notes.md(RELEASE_NOTES_RE 는 case-insensitive) → 미발화
test("missing-release-note-risk: lowercase release-notes.md is recognized (case-insensitive), no trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/order.schema.ts", {
        addedLines: ["export const orderSchema = z.object({});"]
      }),
      fc("release-notes.md", {
        addedLines: ["- order schema added"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// GAP6 FP: CHANGELOG.md 로 문서화한 경우도 릴리스 노트로 인정 → 미발화
test("missing-release-note-risk: CHANGELOG.md update satisfies the requirement", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({ id: z.string() });"]
      }),
      fc("CHANGELOG.md", {
        addedLines: ["## 1.2.0", "- breaking: userSchema requires id"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// GAP6 FP: HISTORY.md (대문자/소문자 무관) 도 표준 릴리스 문서로 인정 → 미발화
test("missing-release-note-risk: HISTORY.md update satisfies the requirement", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("package.json", {
        addedLines: ['  "version": "1.2.0",'],
        deletedLines: ['  "version": "1.1.0",']
      }),
      fc("docs/HISTORY.md", {
        addedLines: ["- 1.2.0 release"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// 경계 3(regex 회피): schema 처럼 보이지만 경로가 src/schemas/ 가 아니라 src/models/ → 미발화
test("missing-release-note-risk: schema-like file outside src/schemas does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/models/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({});"]
      })
    ])
  });
  const out = await missingReleaseNoteRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
