/**
 * ReviewAdapter 인터페이스 — ARCHITECTURE.md §6, §11.
 *
 * 본 파일은 integrations 디렉터리에 둔다. core 는 integrations 를 import 가능하나
 * 반대 방향은 금지(dependency-cruiser no-integration-to-core).
 */

export interface ReviewInput {
  rawDiff: string;
}

export interface ReviewFinding {
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  detail?: string;
  file?: string;
  line?: number;
}

export interface ReviewResult {
  adapterId: string;
  status: "passed" | "warnings" | "failed" | "not_run";
  findings: ReviewFinding[];
  rawPath?: string;
  summary?: string;
}

export interface ReviewAdapter {
  id: string;
  available(): Promise<boolean>;
  run(input: ReviewInput): Promise<ReviewResult>;
}
