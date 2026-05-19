/**
 * architecture rule (Phase QF): layer-violation.
 *
 * 코드 변경의 import 경로가 ARCHITECTURE.md §7 의 의존성 규칙을 침범하는지 검출.
 * 본 도구의 정체성 (`.harness/` source of truth) 와도 연계.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "layer-violation";

const FORBIDDEN_IMPORTS: Array<{
  fromRe: RegExp;
  toRe: RegExp;
  reason: string;
  severity: "critical" | "high" | "warning";
}> = [
  // core/<A> → core/<B> (artifact 통신만 허용)
  {
    fromRe: /^[+]?import .* from .*\.\.\/core\//,
    toRe: /core\/[a-z-]+/,
    reason: "cross-stage core import (artifact only)",
    severity: "high"
  },
  // integrations → core
  {
    fromRe: /integrations\//,
    toRe: /from .*core\//,
    reason: "integrations → core forbidden",
    severity: "critical"
  },
  // utils → core/cli
  {
    fromRe: /utils\//,
    toRe: /from .*\.\.\/(core|cli)\//,
    reason: "utils → core/cli forbidden (leaf only)",
    severity: "high"
  },
  // .claude/ → .harness/ reverse import
  {
    fromRe: /import .* from .*\.claude\//,
    toRe: /\.harness\//,
    reason: ".claude/ → .harness/ reverse import forbidden",
    severity: "critical"
  }
];

export const layerViolationRule: DeterministicRule = {
  id: RULE_ID,
  describe: "core/utils/integrations 의 의존성 규칙 침범 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        const tline = line.trim();
        if (!/^import .* from /.test(tline) && !/^from .* import /.test(tline))
          return;
        for (const p of FORBIDDEN_IMPORTS) {
          // 경로 컨텍스트: source file path 와 라인 둘 다 검사.
          if (p.fromRe.test(f.path) || p.fromRe.test(tline)) {
            if (p.toRe.test(tline)) {
              findings.push(
                makeFinding(
                  RULE_ID,
                  p.severity,
                  `layer violation: ${p.reason}`,
                  { file: f.path, line: idx + 1 }
                )
              );
            }
          }
        }
      });
    }
    return findings;
  }
};
