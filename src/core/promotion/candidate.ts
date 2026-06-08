import { isAbsolute, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalHash } from "../../utils/integrity.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { CandidateDef } from "./store-types.js";

export type ModuleImporter = (modulePath: string) => Promise<Record<string, unknown>>;

// 절대 경로는 Windows 에서 dynamic import 시 file:// URL 이 필요하다(ERR_UNSUPPORTED_ESM_URL_SCHEME 방지).
const defaultImporter: ModuleImporter = (p) =>
  import(isAbsolute(p) ? pathToFileURL(p).href : p) as Promise<Record<string, unknown>>;

/** modulePath 가 root(프로젝트 루트) 안에 있는지. import 전 RCE 봉쇄용 경계 검사. */
function moduleWithinRoot(modulePath: string, root: string): boolean {
  const absRoot = resolve(root);
  const abs = isAbsolute(modulePath)
    ? resolve(modulePath)
    : resolve(absRoot, modulePath);
  return abs === absRoot || abs.startsWith(absRoot + sep);
}

function isDeterministicRule(v: unknown): v is DeterministicRule {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as DeterministicRule).id === "string" &&
    typeof (v as DeterministicRule).describe === "string" &&
    typeof (v as DeterministicRule).run === "function"
  );
}

/**
 * 후보 모듈을 dynamic import 해 DeterministicRule 로 반환. importer 주입 가능(테스트).
 *
 * root 가 주어지면 import 전에 modulePath 가 프로젝트 루트 안에 있는지 검사한다.
 * promoted.json(.harness/ 내부 파일)이 변조돼 modulePath 가 /tmp/evil.js 등 루트
 * 밖 임의 파일을 가리키면 gate 실행 시점에 그 파일이 import=실행된다(RCE). 루트
 * 경계를 강제해 이 경로를 봉쇄한다.
 */
export async function loadCandidateRule(
  candidate: CandidateDef,
  importer: ModuleImporter = defaultImporter,
  root?: string
): Promise<DeterministicRule> {
  if (root !== undefined && !moduleWithinRoot(candidate.modulePath, root)) {
    throw new Error(
      `candidate ${candidate.id}: modulePath "${candidate.modulePath}" escapes the project root (${resolve(root)}) — refusing dynamic import`
    );
  }
  const mod = await importer(candidate.modulePath);
  const rule = mod[candidate.exportName];
  if (!isDeterministicRule(rule)) {
    throw new Error(
      `candidate ${candidate.id}: export "${candidate.exportName}" is not a DeterministicRule`
    );
  }
  return rule;
}

/** §8-1 시험 입력 봉인: 후보 정의 + fixture 파일 묶음의 canonical sha256. */
export function computeFixturesHash(
  candidate: CandidateDef,
  fixtureFiles: Record<string, string>
): string {
  return canonicalHash({ candidate, fixtures: fixtureFiles });
}

export interface FixturesHashCheck {
  ok: boolean;
  expected: string;
  actual: string;
  reason?: string;
}

/**
 * §8-2 동일조건 강제: trial 시점 fixtures 를 재해싱(computeFixturesHash)해
 * submit 시 봉인값(expected)과 대조한다. 불일치 = 다른 fixture 로 시험한 것 → trial 무효.
 */
export function verifyFixturesHash(
  expected: string,
  candidate: CandidateDef,
  fixtureFiles: Record<string, string>
): FixturesHashCheck {
  const actual = computeFixturesHash(candidate, fixtureFiles);
  if (!expected) {
    return { ok: false, expected, actual, reason: "봉인된 fixturesHash 없음 — submit 먼저(§8-2)" };
  }
  if (actual !== expected) {
    return {
      ok: false,
      expected,
      actual,
      reason: `fixtures 가 submit 이후 바뀜(§8-2): expected ${expected.slice(0, 12)}, got ${actual.slice(0, 12)}`
    };
  }
  return { ok: true, expected, actual };
}

export interface MinFixtureCheck {
  ok: boolean;
  positives: number;
  negatives: number;
  reason?: string;
}

/** §9: 권장 최소 positive(BLOCK/NEEDS_HUMAN_REVIEW/INSUFFICIENT_EVIDENCE) ≥ 3, negative(PASS) ≥ 2. */
export function validateMinFixtures(verdicts: readonly string[]): MinFixtureCheck {
  const positives = verdicts.filter(
    (v) => v === "BLOCK" || v === "NEEDS_HUMAN_REVIEW" || v === "INSUFFICIENT_EVIDENCE"
  ).length;
  const negatives = verdicts.filter((v) => v === "PASS").length;
  if (positives < 3 || negatives < 2) {
    return {
      ok: false,
      positives,
      negatives,
      reason: `최소 fixture 미달: positive ${positives}/3, negative ${negatives}/2`
    };
  }
  return { ok: true, positives, negatives };
}
