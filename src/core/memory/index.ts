import type { StageDeps } from "../stage-runner.js";
import { isoNow } from "../../utils/time.js";

export interface MemoryInput {
  kind:
    | "false_positive"
    | "false_negative"
    | "missed_risk"
    | "useful_rule"
    | "noisy_rule"
    | "improved_prompt"
    | "changed_workflow"
    | "milestone_passed";
  summary: string;
  relatedRule?: string;
  relatedTaskId?: string;
  sourceVerdict?: string;
  notes?: string;
}

export interface MemoryResult {
  caseId: string;
  casePath: string;
  memoryMdPath: string;
}

export async function runMemoryAdd(
  input: MemoryInput,
  deps: StageDeps
): Promise<MemoryResult> {
  const at = isoNow(deps.clock);
  const caseId = `${at.replace(/[:.]/g, "-")}-${input.kind}`;
  const data = {
    id: caseId,
    kind: input.kind,
    summary: input.summary,
    relatedRule: input.relatedRule,
    relatedTaskId: input.relatedTaskId,
    createdAt: at,
    sourceVerdict: input.sourceVerdict,
    notes: input.notes
  };
  await deps.artifact.writeJson(`eval-cases/${caseId}.json`, data, "eval-case");

  const md = (await deps.artifact.readMarkdown("memory.md")) ?? "# Memory\n";
  const entry = `\n## ${caseId}\n- kind: ${input.kind}\n- summary: ${input.summary}\n`;
  await deps.artifact.writeMarkdown("memory.md", md + entry);

  return {
    caseId,
    casePath: `.harness/eval-cases/${caseId}.json`,
    memoryMdPath: ".harness/memory.md"
  };
}
