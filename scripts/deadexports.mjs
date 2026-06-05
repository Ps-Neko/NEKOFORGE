#!/usr/bin/env node
/**
 * Dead-export gate: runs ts-prune against tsconfig.prune.json (includes tests)
 * and fails if any truly-unused exports remain outside the known allowlist.
 *
 * Allowlist rationale:
 *   - src/rules/index.ts      : barrel re-exports (evaluateAutoApplyBlock, AutoApplyBlockedError,
 *                                Severity) intentionally re-exported for future public consumers.
 *   - src/core/gate/index.ts  : loadPromotedForCwd explicitly marked "공개 API 호환" in-source.
 *   - promotion-candidates/   : todoCommentRiskRule referenced by export-name string in promote CLI.
 */
import { execSync } from "node:child_process";

// Regex patterns that, if matched, suppress the flagged export.
// Each entry is matched against the raw ts-prune output line.
const ALLOWLIST = [
  /src[/\\]rules[/\\]index\.ts.*evaluateAutoApplyBlock/,
  /src[/\\]rules[/\\]index\.ts.*AutoApplyBlockedError/,
  /src[/\\]rules[/\\]index\.ts.*Severity/,
  /src[/\\]core[/\\]gate[/\\]index\.ts.*loadPromotedForCwd/,
  /promotion-candidates[/\\]todo-comment-risk\.ts.*todoCommentRiskRule/,
];

let output;
try {
  output = execSync("npx ts-prune -p tsconfig.prune.json", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (e) {
  // ts-prune exits non-zero if it finds anything; capture stdout anyway
  output = e.stdout ?? "";
}

const violations = output
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .filter((l) => !l.includes("(used in module)"))
  .filter((l) => !ALLOWLIST.some((re) => re.test(l)));

if (violations.length === 0) {
  console.log("dead-export gate: PASS (0 violations)");
  process.exit(0);
} else {
  console.error("dead-export gate: FAIL — unexpected unused exports:");
  violations.forEach((v) => console.error("  " + v));
  console.error(
    "\nTo fix: remove the `export` keyword, import the symbol directly, or add to the allowlist in scripts/deadexports.mjs."
  );
  process.exit(1);
}
