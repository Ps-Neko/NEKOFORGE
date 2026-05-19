import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runMemoryAdd, type MemoryInput } from "../../core/memory/index.js";
import { runStage } from "./_run.js";

const VALID_KINDS: ReadonlyArray<MemoryInput["kind"]> = [
  "false_positive",
  "false_negative",
  "missed_risk",
  "useful_rule",
  "noisy_rule",
  "improved_prompt",
  "changed_workflow",
  "milestone_passed"
];

interface MemoryAddOpts {
  kind?: string;
  summary?: string;
  rule?: string;
  task?: string;
  verdict?: string;
  notes?: string;
}

export function registerMemory(program: Command): void {
  const memory = program
    .command("memory")
    .description("Add evaluation cases to memory (false_positive, useful_rule, ...)");

  memory
    .command("add")
    .description("Append one eval-case to .harness/eval-cases/")
    .requiredOption(
      "--kind <kind>",
      `case kind (${VALID_KINDS.join(" | ")})`
    )
    .requiredOption("--summary <text>", "one-line summary")
    .option("--rule <ruleId>", "related rule id")
    .option("--task <taskId>", "related task id")
    .option("--verdict <verdict>", "source verdict (PASS, BLOCK, ...)")
    .option("--notes <text>", "additional notes")
    .action(async (opts: MemoryAddOpts) => {
      const kind = opts.kind as MemoryInput["kind"];
      if (!VALID_KINDS.includes(kind)) {
        console.error(`[error] invalid --kind: ${opts.kind}`);
        process.exit(1);
      }
      await runStage(
        () =>
          runMemoryAdd(
            {
              kind,
              summary: opts.summary ?? "",
              ...(opts.rule !== undefined ? { relatedRule: opts.rule } : {}),
              ...(opts.task !== undefined ? { relatedTaskId: opts.task } : {}),
              ...(opts.verdict !== undefined ? { sourceVerdict: opts.verdict } : {}),
              ...(opts.notes !== undefined ? { notes: opts.notes } : {})
            },
            buildDeps()
          ),
        (r) => {
          console.error(`[ok] memory case ${r.caseId} added.`);
          console.error(`[path] ${r.casePath}`);
        }
      );
    });
}
