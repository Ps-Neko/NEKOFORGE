/**
 * quality-contract stage (Phase QF — Quality Factory Upgrade).
 *
 * `work` 단계 진입 전 필수 산출물. 4 종 template 지원.
 *
 * 출력:
 *   .harness/QUALITY-CONTRACT.md (사람용)
 *   .harness/quality-contract.json (schema 검증)
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StageDeps } from "../stage-runner.js";
import { lintProductIntent } from "../../utils/quality-contract-lint.js";

export type ContractTemplate = "web-ui" | "cli-tool" | "backend-api" | "library" | "custom";

export interface ContractInput {
  taskId?: string;
  template?: ContractTemplate;
  answersFile?: string;
  check?: boolean;
}

export interface ContractResult {
  markdownPath: string;
  jsonPath: string;
  template: ContractTemplate;
}

export class ContractPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`quality-contract stage requires ${missing}`);
    this.name = "ContractPrecondError";
  }
}

export class ContractCheckError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "ContractCheckError";
  }
}

const DEFAULT_BARS: Record<ContractTemplate, Record<string, { minimum: number; required: boolean }>> = {
  "web-ui": {
    correctness: { minimum: 80, required: true },
    testCoverage: { minimum: 60, required: true },
    security: { minimum: 90, required: true },
    maintainability: { minimum: 75, required: true },
    architecture: { minimum: 75, required: true },
    ux: { minimum: 80, required: true },
    performance: { minimum: 70, required: false },
    evidence: { minimum: 90, required: true }
  },
  "cli-tool": {
    correctness: { minimum: 85, required: true },
    testCoverage: { minimum: 75, required: true },
    security: { minimum: 90, required: true },
    maintainability: { minimum: 80, required: true },
    architecture: { minimum: 80, required: true },
    ux: { minimum: 60, required: false },
    performance: { minimum: 70, required: false },
    evidence: { minimum: 90, required: true }
  },
  "backend-api": {
    correctness: { minimum: 85, required: true },
    testCoverage: { minimum: 75, required: true },
    security: { minimum: 95, required: true },
    maintainability: { minimum: 80, required: true },
    architecture: { minimum: 85, required: true },
    ux: { minimum: 60, required: false },
    performance: { minimum: 80, required: true },
    evidence: { minimum: 95, required: true }
  },
  library: {
    correctness: { minimum: 90, required: true },
    testCoverage: { minimum: 85, required: true },
    security: { minimum: 90, required: true },
    maintainability: { minimum: 90, required: true },
    architecture: { minimum: 85, required: true },
    ux: { minimum: 50, required: false },
    performance: { minimum: 75, required: false },
    evidence: { minimum: 90, required: true }
  },
  custom: {
    correctness: { minimum: 80, required: true },
    testCoverage: { minimum: 70, required: true },
    security: { minimum: 90, required: true },
    maintainability: { minimum: 80, required: true },
    architecture: { minimum: 80, required: true },
    ux: { minimum: 70, required: false },
    performance: { minimum: 70, required: false },
    evidence: { minimum: 90, required: true }
  }
};

const REQUIRED_EVIDENCE_DEFAULTS = [
  "SPEC.md",
  "PLAN.md",
  "TASKS.md",
  "QUALITY-CONTRACT.md",
  "quality-contract.json",
  "self-review.md",
  "codex-findings.json",
  "quality-score.json"
];

const FORBIDDEN_ACTIONS_DEFAULTS = [
  "auto-commit",
  "auto-push",
  "auto-deploy",
  "apply-without-human-gate"
];

interface ContractJson {
  schemaVersion: "0.4";
  taskId: string;
  productIntent: {
    user: string;
    problem: string;
    coreValue: string;
    nonGoals?: string[];
  };
  acceptanceCriteria: string[];
  qualityBars: Record<string, { minimum: number; required: boolean }>;
  riskProfile?: Record<string, unknown>;
  requiredEvidence: string[];
  forbiddenActions?: string[];
  template?: ContractTemplate;
}

function buildContract(input: ContractInput, productIntent: ContractJson["productIntent"]): ContractJson {
  const template = input.template ?? "custom";
  return {
    schemaVersion: "0.4",
    taskId: input.taskId ?? "TASK-001",
    productIntent,
    acceptanceCriteria: [],
    qualityBars: DEFAULT_BARS[template],
    riskProfile: {
      dangerousFiles: [],
      authTouched: false,
      secretsTouched: false,
      ciTouched: false,
      deployTouched: false,
      uiTouched: template === "web-ui"
    },
    requiredEvidence: [...REQUIRED_EVIDENCE_DEFAULTS],
    forbiddenActions: [...FORBIDDEN_ACTIONS_DEFAULTS],
    template
  };
}

async function loadAnswers(input: ContractInput, cwd: string): Promise<ContractJson["productIntent"]> {
  if (input.answersFile) {
    const text = await readFile(resolve(cwd, input.answersFile), "utf8");
    return JSON.parse(text) as ContractJson["productIntent"];
  }
  return {
    user: "(사용자가 작성)",
    problem: "(사용자가 작성)",
    coreValue: "(사용자가 작성)",
    nonGoals: []
  };
}

function renderMarkdown(c: ContractJson): string {
  return [
    `# QUALITY CONTRACT — ${c.taskId}`,
    "",
    `Template: \`${c.template}\``,
    "",
    "## Product Intent",
    `- 사용자: ${c.productIntent.user}`,
    `- 문제: ${c.productIntent.problem}`,
    `- 핵심 가치: ${c.productIntent.coreValue}`,
    `- 하지 않을 것: ${(c.productIntent.nonGoals ?? []).join(", ") || "(없음)"}`,
    "",
    "## Acceptance Criteria",
    c.acceptanceCriteria.length > 0
      ? c.acceptanceCriteria.map((x) => `- ${x}`).join("\n")
      : "- (사용자가 작성)",
    "",
    "## Quality Bars",
    "| 영역 | 최소 점수 | 필수 |",
    "|---|---|---|",
    ...Object.entries(c.qualityBars).map(
      ([k, v]) => `| ${k} | ${v.minimum} | ${v.required ? "yes" : "no"} |`
    ),
    "",
    "## Required Evidence",
    ...c.requiredEvidence.map((e) => `- ${e}`),
    "",
    "## Forbidden Actions",
    ...(c.forbiddenActions ?? []).map((e) => `- ${e}`)
  ].join("\n");
}

export async function runQualityContract(
  input: ContractInput,
  deps: StageDeps
): Promise<ContractResult> {
  if (input.check) {
    const existing = await deps.artifact.readJson<ContractJson>(
      "quality-contract.json",
      "quality-contract"
    );
    if (!existing) {
      throw new ContractCheckError(
        "quality-contract.json missing or schema invalid"
      );
    }
    // Codex self-audit #2 — productIntent placeholder lint.
    const lintErrors = lintProductIntent(existing.productIntent);
    if (lintErrors.length > 0) {
      throw new ContractCheckError(
        `quality-contract.json has unfilled productIntent: ${lintErrors.join(", ")}`
      );
    }
    return {
      markdownPath: ".harness/QUALITY-CONTRACT.md",
      jsonPath: ".harness/quality-contract.json",
      template: existing.template ?? "custom"
    };
  }

  if (!(await deps.artifact.exists("SPEC.md"))) {
    throw new ContractPrecondError("SPEC.md (run `harness spec`)");
  }

  const intent = await loadAnswers(input, deps.cwd);
  const contract = buildContract(input, intent);

  await deps.artifact.writeJson(
    "quality-contract.json",
    contract,
    "quality-contract"
  );
  await deps.artifact.writeMarkdown(
    "QUALITY-CONTRACT.md",
    renderMarkdown(contract)
  );

  return {
    markdownPath: ".harness/QUALITY-CONTRACT.md",
    jsonPath: ".harness/quality-contract.json",
    template: contract.template ?? "custom"
  };
}
