/**
 * SECURITY.md §3.1 — process.env/secret 부재 시 하드코딩 fallback 차단.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";
import { astSecretFallbackFindings, dedupeFindings } from "./ast-scan.js";

const RULE_ID = "secret-fallback";

const PROCESS_ENV_FALLBACK =
  /process\.env\.[A-Z][A-Z0-9_]*\s*(\|\||\?\?)\s*(['"`])([^'"`]+)\2/g;
// Python: os.environ.get("X", "fallback") 또는 os.getenv("X", "fallback")
const PYTHON_GETENV =
  /os\.(?:environ\.get|getenv)\(\s*['"][A-Z][A-Z0-9_]*['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
// Go: PascalCase helper 함수만 매칭. 소문자 `os.getenv` 는 Python 으로 처리됨.
const GO_GETENV_FALLBACK =
  /\b(?:GetEnvOrDefault|GetEnvDefault|EnvOrDefault|GetenvDefault)\s*\(\s*['"][A-Z][A-Z0-9_]*['"]\s*,\s*['"]([^'"]+)['"]\s*[,)]/g;
const ASSIGN_SECRET =
  /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASS|PWD|API|AUTH))\s*[:=]\s*['"]([^'"\s]{4,})['"]/g;
// 공백 포함 패스프레이즈: `DB_PASSWORD = "correct horse battery staple"`.
// ASSIGN_SECRET 가 공백을 불허해 놓치는 케이스. 따옴표 안 전체(공백 포함)를 캡처하되
// 엔트로피 가드(길이>=12 + distinct char>=10)로 산문/라벨 FP 를 막는다.
const ASSIGN_SECRET_PASSPHRASE =
  /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASS(?:WORD|PHRASE)?|PWD|API|AUTH))\s*[:=]\s*['"]([^'"]{12,})['"]/g;

const EXCLUDE_VALUES = new Set(["", "null", "undefined", "true", "false", "TODO", "TBD"]);

/** 공백 포함 값의 엔트로피 가드 — distinct char 가 적은 산문/반복 라벨을 배제. */
function looksLikePassphrase(value: string): boolean {
  if (!/\s/.test(value)) return false; // 공백 없는 값은 ASSIGN_SECRET 가 이미 처리.
  const distinct = new Set(value.replace(/\s+/g, "")).size;
  return distinct >= 10;
}

function inspectLine(line: string, file: string, idx: number): RuleFinding[] {
  const out: RuleFinding[] = [];

  for (const m of line.matchAll(PROCESS_ENV_FALLBACK)) {
    const literal = m[3] ?? "";
    if (literal.length >= 8 && !EXCLUDE_VALUES.has(literal)) {
      out.push(
        makeFinding(
          RULE_ID,
          "critical",
          `fallback secret literal after env access: ${literal.slice(0, 4)}…`,
          { file, line: idx + 1 }
        )
      );
    }
  }
  for (const m of line.matchAll(PYTHON_GETENV)) {
    const literal = m[1] ?? "";
    if (literal.length >= 8 && !EXCLUDE_VALUES.has(literal)) {
      out.push(
        makeFinding(
          RULE_ID,
          "critical",
          `python env getter fallback literal: ${literal.slice(0, 4)}…`,
          { file, line: idx + 1 }
        )
      );
    }
  }
  for (const m of line.matchAll(GO_GETENV_FALLBACK)) {
    const literal = m[1] ?? "";
    if (literal.length >= 8 && !EXCLUDE_VALUES.has(literal)) {
      out.push(
        makeFinding(
          RULE_ID,
          "critical",
          `go env getter fallback literal: ${literal.slice(0, 4)}…`,
          { file, line: idx + 1 }
        )
      );
    }
  }
  for (const m of line.matchAll(ASSIGN_SECRET)) {
    const name = m[1] ?? "";
    const literal = m[2] ?? "";
    if (
      literal.length >= 4 &&
      !EXCLUDE_VALUES.has(literal) &&
      !literal.startsWith("$") &&
      !literal.startsWith("process.env")
    ) {
      out.push(
        makeFinding(
          RULE_ID,
          "critical",
          `hardcoded secret-like assignment to ${name}`,
          { file, line: idx + 1 }
        )
      );
    }
  }
  for (const m of line.matchAll(ASSIGN_SECRET_PASSPHRASE)) {
    const name = m[1] ?? "";
    const literal = m[2] ?? "";
    if (
      !EXCLUDE_VALUES.has(literal) &&
      !literal.startsWith("$") &&
      !literal.startsWith("process.env") &&
      looksLikePassphrase(literal)
    ) {
      out.push(
        makeFinding(
          RULE_ID,
          "critical",
          `hardcoded passphrase-like assignment to ${name}`,
          { file, line: idx + 1 }
        )
      );
    }
  }
  return out;
}

export const secretFallbackRule: DeterministicRule = {
  id: RULE_ID,
  describe: "환경변수/secret 부재 시 fallback 리터럴 사용 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];
    for (const f of ctx.diff.files) {
      if (f.status === "deleted") continue;
      f.addedLines.forEach((line, idx) => {
        findings.push(...inspectLine(line, f.path, idx));
      });
      // AST 보강 — 정규식이 놓치는 문자열 연결/템플릿 fallback 시크릿.
      findings.push(...astSecretFallbackFindings(f.addedLines, f.path, RULE_ID));
    }
    return dedupeFindings(findings);
  }
};
