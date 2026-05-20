/**
 * docs-quality rule: broken-doc-link-risk.
 *
 * Markdown 안에 새 상대 링크 `](path/to/file.md)` 추가 + 같은 diff 에 그 파일
 * 추가 없음 + 본 휴리스틱은 path 가 docs/ 또는 ../ 로 시작하는 경우만.
 *
 * 정확도 한계: 기존 파일 가리키는 링크도 발화 가능. info 등급.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "broken-doc-link-risk";
const MD_LINK_RE = /\]\((\.?\.\/[^)\s]+\.md|docs\/[^)\s]+\.md)\)/g;

export const brokenDocLinkRiskRule: DeterministicRule = {
  id: RULE_ID,
  describe: "Markdown 새 link 추가 시 대상 .md 가 같은 diff 에 없음 — info 알림",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    const newOrModifiedMd = ctx.diff.files.filter(
      (f) => /\.md$/i.test(f.path) && f.status !== "deleted"
    );
    if (newOrModifiedMd.length === 0) return findings;
    const allPaths = new Set(ctx.diff.files.map((f) => f.path));
    for (const f of newOrModifiedMd) {
      const links = new Set<string>();
      for (const line of f.addedLines) {
        let m: RegExpExecArray | null;
        const re = new RegExp(MD_LINK_RE.source, "g");
        while ((m = re.exec(line)) !== null) {
          if (m[1]) links.add(m[1]);
        }
      }
      for (const link of links) {
        // 같은 diff 에 추가됐으면 OK.
        const cleaned = link.replace(/^\.\//, "").replace(/^\.\.\//, "");
        if (
          Array.from(allPaths).some(
            (p) => p.endsWith(cleaned) || p === cleaned
          )
        ) {
          continue;
        }
        // info — 기존 파일 가리키는 link 도 발화 가능, verdict 영향 없음.
        findings.push(
          makeFinding(
            RULE_ID,
            "info",
            `markdown link ${link} target not in same diff (verify file exists)`,
            { file: f.path }
          )
        );
      }
    }
    return findings;
  }
};
