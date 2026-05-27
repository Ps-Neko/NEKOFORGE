import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalHash } from "../../utils/integrity.js";
import type { DeterministicRule } from "../../rules/types.js";
import type { CandidateDef } from "./store-types.js";

export type ModuleImporter = (modulePath: string) => Promise<Record<string, unknown>>;

// 절대 경로는 Windows 에서 dynamic import 시 file:// URL 이 필요하다(ERR_UNSUPPORTED_ESM_URL_SCHEME 방지).
const defaultImporter: ModuleImporter = (p) =>
  import(isAbsolute(p) ? pathToFileURL(p).href : p) as Promise<Record<string, unknown>>;

function isDeterministicRule(v: unknown): v is DeterministicRule {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as DeterministicRule).id === "string" &&
    typeof (v as DeterministicRule).describe === "string" &&
    typeof (v as DeterministicRule).run === "function"
  );
}

/** 후보 모듈을 dynamic import 해 DeterministicRule 로 반환. importer 주입 가능(테스트). */
export async function loadCandidateRule(
  candidate: CandidateDef,
  importer: ModuleImporter = defaultImporter
): Promise<DeterministicRule> {
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
