/**
 * dependency-risk rule (Phase RP-2): unbounded-version-risk.
 *
 * package.json 의 dependencies/devDependencies 에 `"*"` 또는 `">=X"` 형태 추가 시 경고.
 * caret(`^`) 와 tilde(`~`) 는 일반 관행이므로 미발화.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";
import { sectionStates, inDepsSection } from "./_section.js";

const RULE_ID = "unbounded-version-risk";

/** `"<key>": "<value>"` 에서 key/value 를 분리. 최상위 메타 key 는 제외. */
const DEP_KV_RE =
  /^\s*"(?!(?:version|name|description|license|author|type|main|module|types|typings|homepage|bugs|funding|keywords|private|sideEffects|packageManager|tag|access)")([a-zA-Z@][^"]*)"\s*:\s*"([^"]*)"/;

/**
 * trim 된 value 가 unbounded 범위인지 판정.
 *  - `*` (전체 와일드카드)
 *  - 선두 비교연산자 `>` / `>=` / `<` / `<=` (선행 공백 우회 포함 — 호출 전 trim)
 *  - `latest`
 *  - 부분 와일드카드: `x`/`X` 단독, 또는 `1.x` / `1.2.x` 처럼 wildcard 포함
 */
function isUnbounded(rawValue: string): boolean {
  const v = rawValue.trim();
  if (v === "") return false;
  if (v === "*" || v === "latest") return true;
  if (/^[<>]=?/.test(v)) return true;
  // 부분 와일드카드: 단독 x/X, 또는 숫자.x 형태(예: 1.x, 1.2.x).
  if (/^[xX*]$/.test(v)) return true;
  if (/(^|\.)[xX*](\.|$)/.test(v)) return true;
  return false;
}

export const unboundedVersionRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json 에 unbounded version (*, >=, latest, 1.x) 추가 시 경고",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/(^|\/)package\.json$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      const states = sectionStates(f.addedLines);
      f.addedLines.forEach((line, idx) => {
        // 명시적 비-dependency 섹션(publishConfig/scripts 등) 안쪽은 제외(FP).
        if (!inDepsSection(states[idx] ?? "unknown")) return;
        const m = DEP_KV_RE.exec(line);
        if (!m) return;
        if (isUnbounded(m[2] ?? "")) {
          findings.push(
            makeFinding(
              RULE_ID,
              "warning",
              "unbounded dependency version (*, >=, latest, partial wildcard)",
              { file: f.path, line: idx + 1 }
            )
          );
        }
      });
    }
    return findings;
  }
};
