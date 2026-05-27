import type { PromoteVerdict } from "./types.js";

/** P1b 범위: rule 만. experience/skill-pack 은 P2/P3. */
export type PromotionKind = "rule";

/** 후보 정의 — 후보 rule 모듈을 가리킨다(코드 자동생성 없음). */
export interface CandidateDef {
  id: string;
  kind: PromotionKind;
  /** 레포 루트 기준 상대 경로의 rule 모듈(.ts/.js). */
  modulePath: string;
  /** 그 모듈에서 DeterministicRule 을 export 하는 이름. */
  exportName: string;
  submittedAt: string;
  /** P2: 이 후보의 동기가 된 eval-case id 목록(provenance). 선택적. */
  experiences?: string[];
}

/** trial.json — baseline vs candidate 점수 + 판정 + 봉인. */
export interface TrialRecord {
  baseline: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number };
  candidate: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number };
  verdict: PromoteVerdict;
  reasons: string[];
  /** canonicalHash(후보 + fixture 묶음) — §8-1 시험 입력 봉인. */
  fixturesHash: string;
  ranAt: string;
}

/** decision.json — 사람 판정 + 승인 봉인. */
export interface PromotionDecisionRecord {
  verdict: "approved" | "rejected";
  approvedBy?: string;
  /** canonicalHash(승인 시점 trial.json) — §8-3 승인 봉인. */
  approvalHash?: string;
  reason?: string;
  decidedAt: string;
}

/** promoted.json 항목 — 채용된 rule(동적 로딩 대상). */
export interface PromotedRuleEntry {
  id: string;
  modulePath: string;
  exportName: string;
  promotedAt: string;
  approvalHash: string;
  /** P2: 채용 시 봉인되는 출처 경험(candidate 에서 복사). */
  experiences?: string[];
}

export interface PromotedManifest {
  rules: PromotedRuleEntry[];
}

/** ledger.jsonl 한 줄 — append-only + chain(§8-4). */
export interface LedgerEntry {
  action: "submit" | "trial" | "approve" | "reject";
  id: string;
  verdict?: string;
  at: string;
  prev_hash: string | null;
  line_hash: string;
}

/** ledger append 입력(체인 필드 제외). ledger.ts / store.ts 가 공유. */
export type NewLedgerInput = Omit<LedgerEntry, "prev_hash" | "line_hash">;
