/**
 * architecture rule (Phase QF): circular-dependency-risk.
 *
 * diff 만으로는 진정한 cycle 검출이 어렵다. 본 rule 은 휴리스틱:
 * - 같은 파일에서 자기 폴더 외 형제 폴더를 import 하는 (../sibling/) 패턴이
 *   `core/<A>` → `core/<B>` 같은 cross-stage 와 결합하면 경고.
 * - 본격적 cycle 검출은 `dependency-cruiser` 가 별도로 담당.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "circular-dependency-risk";

const SIBLING_IMPORT_RE = /from\s+['"]\.\.\/[^./][^'"]*['"]/;

export const circularDependencyRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "형제 폴더 cross-import 가 새로 등장 — cycle 위험 후보",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/\.(ts|tsx|js|jsx)$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const addedSiblings = f.addedLines.filter((l) => SIBLING_IMPORT_RE.test(l));
      if (addedSiblings.length >= 3) {
        findings.push(
          makeFinding(
            RULE_ID,
            "warning",
            `${addedSiblings.length} sibling imports added — verify no cycle`,
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
