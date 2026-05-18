import type { StageDeps } from "../stage-runner.js";
import { isoNow } from "../../utils/time.js";

export interface IntakeInput {
  goal: string;
  source?: string;
}

export interface IntakeResult {
  path: string;
}

export async function runIntake(
  input: IntakeInput,
  deps: StageDeps
): Promise<IntakeResult> {
  const at = isoNow(deps.clock);
  const content = [
    `# Intake — ${at}`,
    "",
    `- source: ${input.source ?? "cli"}`,
    "- requestKind: feature",
    "- estimatedRisk: medium",
    "- goal: |",
    `  ${input.goal.replace(/\r?\n/g, "\n  ")}`,
    ""
  ].join("\n");
  await deps.artifact.writeMarkdown("intake.md", content);
  return { path: ".harness/intake.md" };
}
