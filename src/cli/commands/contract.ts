import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  runQualityContract,
  type ContractTemplate
} from "../../core/quality-contract/index.js";
import { runStage } from "./_run.js";

const VALID_TEMPLATES: ContractTemplate[] = [
  "web-ui",
  "cli-tool",
  "backend-api",
  "library",
  "custom"
];

interface ContractOpts {
  template?: string;
  taskId?: string;
  answers?: string;
  check?: boolean;
}

export function registerContract(program: Command): void {
  program
    .command("contract")
    .description(
      "Create or validate quality-contract.json (Phase QF — required before work)"
    )
    .option(
      "--template <name>",
      `contract template (${VALID_TEMPLATES.join(" | ")})`,
      "custom"
    )
    .option("--task <id>", "task id to bind", "TASK-001")
    .option("--answers <file>", "productIntent JSON file (non-interactive)")
    .option("--check", "validate existing quality-contract.json only")
    .action(async (opts: ContractOpts) => {
      const template = opts.template ?? "custom";
      if (!VALID_TEMPLATES.includes(template as ContractTemplate)) {
        console.error(`[error] unknown template: ${template}`);
        process.exit(1);
      }
      await runStage(
        () =>
          runQualityContract(
            {
              template: template as ContractTemplate,
              taskId: opts.taskId ?? "TASK-001",
              check: opts.check === true,
              ...(opts.answers !== undefined ? { answersFile: opts.answers } : {})
            },
            buildDeps()
          ),
        (r) => {
          console.error(
            `[ok] ${r.jsonPath} (template=${r.template}); ${r.markdownPath} saved.`
          );
          console.error(`[next] harness plan`);
        }
      );
    });
}
