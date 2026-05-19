import type { StageDeps } from "../stage-runner.js";
import type {
  ReviewAdapter,
  ReviewResult as AdapterResult
} from "../../integrations/review-adapter.js";
import { isoNow } from "../../utils/time.js";
import { maskSecrets } from "../../utils/mask.js";
import { runHooks } from "../../hooks/runner.js";
import type { Hook } from "../../hooks/types.js";

interface HooksJson {
  hooks: Hook[];
}

export interface ReviewInput {
  adapters?: readonly ReviewAdapter[];
  skipSelf?: boolean;
}

export interface ReviewStageResult {
  selfPath: string | null;
  codexPath: string;
  findingsPath: string;
  adapterStatus: AdapterResult["status"];
  adapterCount: number;
}

export class ReviewPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`review stage requires ${missing}`);
    this.name = "ReviewPrecondError";
  }
}

const SELF_TEMPLATE = `# Self Review

## 요구사항 충족
- (확인 항목)

## acceptance criteria 충족
- (확인 항목)

## 테스트 여부
- (확인 항목)

## edge case
- (확인 항목)

## 보안 위험
- (확인 항목)

## 불필요한 복잡도
- (확인 항목)

## 기존 구조 일관성
- (확인 항목)

## rollback 가능성
- (확인 항목)
`;

export async function runReview(
  input: ReviewInput,
  deps: StageDeps
): Promise<ReviewStageResult> {
  if (!(await deps.artifact.exists("worklog.md"))) {
    throw new ReviewPrecondError("worklog.md (run `harness work`)");
  }

  let selfPath: string | null = null;
  if (!input.skipSelf) {
    await deps.artifact.writeMarkdown("self-review.md", SELF_TEMPLATE);
    selfPath = ".harness/self-review.md";
  }

  const adapters = input.adapters ?? [];
  const available = await filterAvailable(adapters);

  let aggregateStatus: AdapterResult["status"] = "not_run";
  const allFindings: AdapterResult["findings"] = [];
  const perAdapterStatus: Array<{ id: string; status: AdapterResult["status"] }> = [];

  if (available.length === 0) {
    aggregateStatus = "not_run";
  } else {
    // SECURITY.md §8 — adapter 통신 경로의 secret 마스킹.
    const rawDiff = (await deps.artifact.readMarkdown("last-diff.patch")) ?? "";
    const safeDiff = maskSecrets(rawDiff);
    for (const a of available) {
      const r = await a.run({ rawDiff: safeDiff });
      perAdapterStatus.push({ id: a.id, status: r.status });
      // 보수적 정책: failed > warnings > passed > not_run.
      if (r.status === "failed") aggregateStatus = "failed";
      else if (r.status === "warnings" && aggregateStatus !== "failed")
        aggregateStatus = "warnings";
      else if (
        r.status === "passed" &&
        aggregateStatus !== "failed" &&
        aggregateStatus !== "warnings"
      )
        aggregateStatus = "passed";
      for (const f of r.findings) allFindings.push(f);
    }
  }

  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const disagreement = detectDisagreement(perAdapterStatus);

  const summaryParts = [
    `${available.length} adapter(s) executed`,
    `${allFindings.length} findings (${criticalCount} critical)`
  ];
  if (disagreement) summaryParts.push(`disagreement: ${disagreement}`);

  const findings = {
    schemaVersion: "0.3",
    adapterId: available.map((a) => a.id).join("+") || "none",
    status: aggregateStatus,
    findings: allFindings,
    summary: summaryParts.join("; ")
  };
  await deps.artifact.writeJson(
    "codex-findings.json",
    findings,
    "codex-findings"
  );

  const reviewMd = [
    `# Codex Review — ${isoNow(deps.clock)}`,
    "",
    `- adapters: ${available.length}`,
    `- status: ${aggregateStatus}`,
    `- findings: ${allFindings.length} (critical=${criticalCount})`,
    "",
    available.length === 0
      ? "_no review adapter is configured. Run with `--adapter` set or register one in .harness/config.json._"
      : "see codex-findings.json for raw findings"
  ].join("\n");
  await deps.artifact.writeMarkdown("codex-review.md", reviewMd);

  // post-review hooks (Phase D 후속 — Codex feedback #2)
  const hooksData = await deps.artifact
    .readJson<HooksJson>("hooks.json")
    .catch(() => null);
  const postHooks = (hooksData?.hooks ?? []).filter(
    (h) => h.type === "post-review"
  );
  await runHooks(postHooks, { stage: "review", cwd: deps.cwd });

  return {
    selfPath,
    codexPath: ".harness/codex-review.md",
    findingsPath: ".harness/codex-findings.json",
    adapterStatus: aggregateStatus,
    adapterCount: available.length
  };
}

async function filterAvailable(
  adapters: readonly ReviewAdapter[]
): Promise<ReviewAdapter[]> {
  const out: ReviewAdapter[] = [];
  for (const a of adapters) {
    if (await a.available()) out.push(a);
  }
  return out;
}

function detectDisagreement(
  results: ReadonlyArray<{ id: string; status: AdapterResult["status"] }>
): string | null {
  if (results.length < 2) return null;
  const unique = new Set(results.map((r) => r.status));
  if (unique.size === 1) return null;
  return results.map((r) => `${r.id}=${r.status}`).join(", ");
}
