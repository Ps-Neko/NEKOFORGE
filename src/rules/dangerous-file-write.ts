/**
 * SECURITY.md §3.5 — 민감 파일 변경 시 Human Gate.
 */
import type { DeterministicRule, RuleFinding } from "./types.js";
import { makeFinding } from "./types.js";

const RULE_ID = "dangerous-file-write";

const PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)credentials?(\.|\/)/i,
  /(^|\/)secrets?(\.|\/)/i,
  /\.(pem|key|crt|p12|pfx)$/i,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)\.gitlab-ci\.ya?ml$/,
  /(^|\/)circle\.ya?ml$/,
  /(^|\/)azure-pipelines\.ya?ml$/,
  /(^|\/)Dockerfile$/,
  /(^|\/)docker-compose.*\.ya?ml$/,
  /(^|\/)kubernetes\//,
  /(^|\/)helm\//,
  /(^|\/)terraform\//,
  /(^|\/)pulumi\//,
  /(^|\/)(auth|iam|oauth|jwt|session)\//i
];

export const dangerousFileWriteRule: DeterministicRule = {
  id: RULE_ID,
  describe: "민감 경로 (.env, CI, deploy, auth) 변경 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      for (const re of PATTERNS) {
        if (re.test(f.path)) {
          findings.push(
            makeFinding(
              RULE_ID,
              "high",
              `dangerous file modified: ${f.path} (${f.status})`,
              { file: f.path }
            )
          );
          break;
        }
      }
    }
    return findings;
  }
};
