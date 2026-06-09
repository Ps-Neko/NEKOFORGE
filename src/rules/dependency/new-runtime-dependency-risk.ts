/**
 * dependency-risk rule: new-runtime-dependency-risk.
 *
 * package.json 의 `dependencies` 섹션에 새 항목 추가 시 warning.
 * devDependencies 는 제외.
 *
 * 휴리스틱 한계: diff 에 dependencies 섹션 경계가 안 보일 수 있어, 본 rule 은
 * `+    "<name>": "..."` 패턴 + 다른 dependency-risk 신호 (lifecycle/unbounded)
 * 가 같은 파일에 동시 등장하지 않는 경우만 발화.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";
import { sectionStates, inDepsSection } from "./_section.js";

const RULE_ID = "new-runtime-dependency-risk";

// 최상위 메타 key (version/name 등) 는 dependency 가 아니므로 제외(version bump FP).
const META_KEY_RE =
  /^\s*"(?:version|name|description|license|author|type|main|module|types|typings|homepage|bugs|funding|keywords|private|sideEffects|packageManager)"\s*:/;
// dependency value: 숫자/caret/tilde 에 더해 git+/github:/npm:/file:/link:/workspace:/tarball alias(gap 2 FN).
const DEP_LINE_RE =
  /^\s*"[a-zA-Z@][^"]*":\s*"(?:[\^~]?\d|(?:git\+|git:|github:|npm:|file:|link:|workspace:|portal:)|https?:\/\/[^"]+\.(?:tgz|tar\.gz))/;
const DEV_DEP_SECTION_RE = /"devDependencies"\s*:/;

export const newRuntimeDependencyRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "package.json dependencies 에 새 의존성 추가",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (!/(^|\/)package\.json$/.test(f.path)) continue;
      if (f.status === "deleted") continue;
      // devDependencies 섹션이 같이 변경됐는지 — 변경됐으면 dev/runtime 구분 어려움.
      const added = f.addedLines.join("\n");
      const inDevSection = DEV_DEP_SECTION_RE.test(added);
      const states = sectionStates(f.addedLines);
      let count = 0;
      let firstLine = -1;
      f.addedLines.forEach((line, idx) => {
        // 명시적 비-dependency 섹션 안쪽 / 최상위 메타 key 는 제외(version bump FP).
        if (!inDepsSection(states[idx] ?? "unknown")) return;
        if (META_KEY_RE.test(line)) return;
        if (DEP_LINE_RE.test(line)) {
          count += 1;
          if (firstLine === -1) firstLine = idx + 1;
        }
      });
      // info 등급 — verdict 영향 없음, 단순 알림. 정상 dependency 추가는 흔하며,
      // 실제 위험 시그널은 postinstall-script / unbounded-version 이 별도로 잡음.
      if (count > 0) {
        findings.push(
          makeFinding(
            RULE_ID,
            "info",
            `${count} dependency line(s) added to package.json${inDevSection ? " (devDependencies section also touched)" : ""}`,
            { file: f.path, line: firstLine > 0 ? firstLine : 0 }
          )
        );
      }
    }
    return findings;
  }
};
