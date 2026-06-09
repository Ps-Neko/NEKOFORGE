/**
 * dependency-risk rule: postinstall-script-risk.
 *
 * 별도 rule 로 분리 (hook-injection-risk 와 중복되지만 dependency-risk pack 의
 * 1차 시민). package.json 의 postinstall/preinstall/prepare 스크립트 추가 감지.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";
import { scriptScopeStates } from "./_section.js";

const RULE_ID = "postinstall-script-risk";

/**
 * npm 전용 lifecycle key — 도구 설정과 이름이 겹치지 않으므로 섹션 무관하게 발화.
 * prepublishOnly/prepack/postpack 보강(gap 3 FN). (prepublish 는 deprecated alias 유지.)
 */
const NPM_LIFECYCLE_RE =
  /"(?:postinstall|preinstall|prepublish|prepublishOnly|prepack|postpack)"\s*:/;
/**
 * "prepare" 는 husky/release-it 등 도구 설정에서도 쓰므로 모호. scripts 섹션이거나
 * 섹션 미확정(unknown)일 때만 발화하고, 도구 설정 블록 안이면 무시(gap 3 FP).
 */
const PREPARE_RE = /"prepare"\s*:/;

export const postinstallScriptRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json lifecycle script (postinstall 등) 추가",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/(^|\/)package\.json$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const scopes = scriptScopeStates(f.addedLines);
      f.addedLines.forEach((line, idx) => {
        const isNpmLifecycle = NPM_LIFECYCLE_RE.test(line);
        const isPrepare =
          PREPARE_RE.test(line) && scopes[idx] !== "tool-config";
        if (isNpmLifecycle || isPrepare) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "package.json lifecycle script added (post/pre install/prepare/prepack/prepublish)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
