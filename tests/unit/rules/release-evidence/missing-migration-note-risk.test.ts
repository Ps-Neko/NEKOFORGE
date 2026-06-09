import { test } from "node:test";
import assert from "node:assert/strict";
import { missingMigrationNoteRiskRule } from "../../../../src/rules/release-evidence/missing-migration-note-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

// TP: schema 변경 + RELEASE-NOTES 변경 + migration/breaking 키워드 부재 → info finding 발화.
test("missing-migration-note-risk: schema change + release notes without migration keyword triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({ id: z.string() });"]
      }),
      fc("RELEASE-NOTES.md", {
        addedLines: ["## v1.2.0", "- Added a new dashboard widget."]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.ok(
    out.some(
      (f) => f.severity === "info" && f.ruleId === "missing-migration-note-risk"
    )
  );
});

// TP: 중첩 경로 src/.../schemas/*.schema.ts 도 SCHEMA_RE 의 (^|\/) 로 매칭됨.
test("missing-migration-note-risk: nested schema path also triggers", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("packages/core/src/schemas/order.schema.ts", {
        addedLines: ["field: z.number()"]
      }),
      fc("RELEASE-NOTES.md", {
        addedLines: ["- minor copy tweak"]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.severity === "info").length,
    1
  );
});

// TN(경계): RELEASE-NOTES added line 에 migration 키워드가 있으면 미발화.
test("missing-migration-note-risk: migration keyword present suppresses finding", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["export const userSchema = z.object({ id: z.string() });"]
      }),
      fc("RELEASE-NOTES.md", {
        addedLines: [
          "## v2.0.0",
          "### Breaking changes",
          "- Run the migration script before upgrading."
        ]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: schema 변경이 없으면 (RELEASE-NOTES 만 변경) 미발화.
test("missing-migration-note-risk: no schema change does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("RELEASE-NOTES.md", {
        addedLines: ["- random note without keyword"]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// TN: schema 변경은 있으나 RELEASE-NOTES 파일이 diff 에 없으면 미발화
// (missing-release-note-risk 룰이 별도로 잡는 영역).
test("missing-migration-note-risk: schema change but no RELEASE-NOTES file does not trigger", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["field: z.boolean()"]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(out.length, 0);
});

// 경계: 키워드가 deletedLines 에만 있고 addedLines 에는 없으면 발화해야 함
// (룰은 addedLines 만 검사하므로).
test("missing-migration-note-risk: keyword only in deleted lines still triggers", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["renamed: z.string()"]
      }),
      fc("RELEASE-NOTES.md", {
        addedLines: ["- general improvements"],
        deletedLines: ["- previous migration note"]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.severity === "info").length,
    1
  );
});

// 경계: 파일명 대소문자 무시 (RELEASE_NOTES_RE 는 i 플래그) + 키워드도 대문자 변형 매칭.
test("missing-migration-note-risk: case-insensitive file + keyword match suppresses", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/schemas/user.schema.ts", {
        addedLines: ["field: z.string()"]
      }),
      fc("release-notes.md", {
        addedLines: ["- This is a BREAKING change."]
      })
    ])
  });
  const out = await missingMigrationNoteRiskRule.run(ctx);
  assert.equal(out.length, 0);
});
