/**
 * release-evidence rule: missing-release-note-risk.
 *
 * breaking change 의심 (schema 파일 / public API 변경 / package.json version 변경)
 * + RELEASE-NOTES.md 미변경 시 발화.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-release-note-risk";

const SCHEMA_RE = /(^|\/)src\/schemas\/.*\.schema\.ts$/;
const PACKAGE_VERSION_LINE_RE = /"version":\s*"[^"]+"/;
const RELEASE_NOTES_RE = /(^|\/)RELEASE-NOTES\.md$/i;

export const missingReleaseNoteRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "schema/version 변경 + RELEASE-NOTES 미갱신",
  async run(ctx) {
    let touchedSchemaOrVersion = false;
    let touchedReleaseNotes = false;
    for (const f of ctx.diff.files) {
      if (SCHEMA_RE.test(f.path)) touchedSchemaOrVersion = true;
      if (/(^|\/)package\.json$/.test(f.path)) {
        if (f.addedLines.some((l) => PACKAGE_VERSION_LINE_RE.test(l))) {
          touchedSchemaOrVersion = true;
        }
      }
      if (RELEASE_NOTES_RE.test(f.path)) touchedReleaseNotes = true;
    }
    if (touchedSchemaOrVersion && !touchedReleaseNotes) {
      return [
        makeFinding(
          RULE_ID,
          "warning",
          "schema or package version changed but RELEASE-NOTES.md untouched"
        )
      ];
    }
    return [] as RuleFinding[];
  }
};
