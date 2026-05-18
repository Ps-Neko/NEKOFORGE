/**
 * SECURITY.md §3.6 — hook · lifecycle command · CI script 변경 (v3 신규).
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "hook-injection-risk";

const HOOK_FILE_PATTERNS = [
  /(^|\/)\.harness\/hooks\.json$/,
  /(^|\/)\.husky\//,
  /(^|\/)\.lefthook\.ya?ml$/,
  /(^|\/)\.pre-commit-config\.ya?ml$/,
  /(^|\/)package\.json$/
];

const LIFECYCLE_SCRIPT_RE =
  /"(postinstall|preinstall|prepare|prepublish|prepublishOnly|precommit|postcommit)"\s*:/;

export const hookInjectionRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "hook · lifecycle script · CI command 변경 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      const hitHookFile = HOOK_FILE_PATTERNS.some((p) => p.test(f.path));
      if (!hitHookFile) continue;

      if (f.path.endsWith("package.json")) {
        const lifecycleAdded = f.addedLines.some((l) => LIFECYCLE_SCRIPT_RE.test(l));
        if (lifecycleAdded) {
          findings.push(
            makeFinding(
              RULE_ID,
              "high",
              `lifecycle script added/modified in ${f.path}`,
              { file: f.path }
            )
          );
        }
        continue;
      }

      findings.push(
        makeFinding(RULE_ID, "high", `hook config modified: ${f.path}`, {
          file: f.path
        })
      );
    }

    if ((ctx.hooksCommandWhitelistViolations ?? 0) > 0) {
      findings.push(
        makeFinding(
          RULE_ID,
          "high",
          `${ctx.hooksCommandWhitelistViolations} hook command(s) outside whitelist`
        )
      );
    }

    return findings;
  }
};
