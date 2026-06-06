#!/usr/bin/env node
/**
 * Dead-export gate: runs knip (successor to the unmaintained ts-prune) and
 * fails if any unused exports/files/dependencies remain outside the allowlist
 * declared in knip.json.
 *
 * Allowlist rationale (see knip.json):
 *   - ignoreDependencies: cli-table3, picocolors — used at runtime via dynamic
 *     require; knip's static analysis misses them (out of scope for this gate).
 *   - ignore: src/rules/promotion-candidates/** — todoCommentRiskRule is
 *     referenced by export-name string in the promote CLI (dynamic import).
 *   - ignoreIssues per-file: public-API types/classes exported intentionally
 *     for downstream consumers (Error subclasses, input/result interfaces, etc.)
 *   - ignoreExportsUsedInFile: suppresses module-internal re-use false positives.
 */
import { execSync } from "node:child_process";

let output;
let exitCode = 0;
try {
  output = execSync("npx knip --reporter compact --no-progress", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (e) {
  // knip exits non-zero when violations are found; capture stdout anyway
  output = e.stdout ?? "";
  exitCode = e.status ?? 1;
}

const trimmed = (output ?? "").trim();

if (exitCode === 0 || trimmed === "") {
  console.log("dead-export gate: PASS (0 violations)");
  process.exit(0);
} else {
  console.error("dead-export gate: FAIL — knip found issues:");
  console.error(trimmed);
  console.error(
    "\nTo fix: remove the export/dependency, add an import, or add to the allowlist in knip.json."
  );
  process.exit(1);
}
