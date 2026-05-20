/**
 * release-evidence rule: missing-migration-note-risk.
 *
 * schema 변경 + RELEASE-NOTES.md 변경 + RELEASE-NOTES 안의 "Migration" 또는
 * "Breaking" 키워드 부재 — info 등급.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-migration-note-risk";
const SCHEMA_RE = /(^|\/)src\/schemas\/.*\.schema\.ts$/;
const RELEASE_NOTES_RE = /(^|\/)RELEASE-NOTES\.md$/i;
const MIGRATION_KEYWORD_RE = /(migration|breaking|migrate|backward[\s-]?compat)/i;

export const missingMigrationNoteRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "schema 변경 + RELEASE-NOTES 의 migration/breaking 키워드 부재",
  async run(ctx) {
    const touchedSchema = ctx.diff.files.some((f) => SCHEMA_RE.test(f.path));
    if (!touchedSchema) return [];
    const releaseNoteFile = ctx.diff.files.find((f) =>
      RELEASE_NOTES_RE.test(f.path)
    );
    if (!releaseNoteFile) return []; // missing-release-note-risk 가 별도 잡음.
    const hasMigrationKeyword = releaseNoteFile.addedLines.some((l) =>
      MIGRATION_KEYWORD_RE.test(l)
    );
    if (!hasMigrationKeyword) {
      return [
        makeFinding(
          RULE_ID,
          "info",
          "schema changed + RELEASE-NOTES updated but no migration/breaking keyword in added lines"
        )
      ];
    }
    return [] as RuleFinding[];
  }
};
