/**
 * docs-quality rule: missing-cli-doc-risk.
 *
 * src/cli/commands/*.ts 신규 파일 추가 + docs/CLI.md 미변경.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "missing-cli-doc-risk";
const CLI_COMMAND_RE = /(^|\/)src\/cli\/commands\/.+\.ts$/;
const CLI_DOC_RE = /(^|\/)docs\/CLI\.md$/i;

export const missingCliDocRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "src/cli/commands/*.ts 신규 추가 + docs/CLI.md 미변경",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    const newCli = ctx.diff.files.filter(
      (f) => CLI_COMMAND_RE.test(f.path) && f.status === "added"
    );
    if (newCli.length === 0) return findings;
    const touchedDoc = ctx.diff.files.some((f) => CLI_DOC_RE.test(f.path));
    if (!touchedDoc) {
      findings.push(
        makeFinding(
          RULE_ID,
          "warning",
          `${newCli.length} new CLI command file(s) added but docs/CLI.md untouched`,
          { file: newCli[0]?.path ?? "" }
        )
      );
    }
    return findings;
  }
};
