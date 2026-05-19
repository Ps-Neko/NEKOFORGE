import type { Command } from "commander";
import { exportClaude } from "../../integrations/claude/export.js";
import { exportCursor } from "../../integrations/cursor/export.js";
import { exportCodex } from "../../integrations/codex/export.js";
import { exportGeneric } from "../../integrations/generic/export.js";
import { resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runStage } from "./_run.js";

const TOOLS = ["claude", "cursor", "codex", "generic"] as const;
type Tool = (typeof TOOLS)[number];

export function registerExport(program: Command): void {
  program
    .command("export")
    .description(
      "Export .harness/ to external tool format (claude | cursor | codex | generic)"
    )
    .argument("<tool>", `target tool (${TOOLS.join(" | ")})`)
    .action(async (tool: string) => {
      if (!TOOLS.includes(tool as Tool)) {
        console.error(`[error] unknown export target: ${tool}`);
        process.exit(1);
      }
      const cwd = resolveWorkspaceCwd();
      if (tool === "claude") {
        await runStage(
          () => exportClaude({ cwd }),
          (r) => {
            console.error(
              `[ok] exported ${r.agents.length} agent(s), ${r.skills.length} skill(s), pointer at ${r.pointer}`
            );
          }
        );
        return;
      }
      if (tool === "cursor") {
        await runStage(
          () => exportCursor({ cwd }),
          (r) => {
            console.error(
              `[ok] exported ${r.ruleFiles.length} rule file(s), ${r.contextFiles.length} context file(s) under .cursor/`
            );
          }
        );
        return;
      }
      if (tool === "codex") {
        await runStage(
          () => exportCodex({ cwd }),
          (r) => {
            console.error(
              `[ok] exported ${r.agents.length} agent(s) and policy at ${r.policy}`
            );
          }
        );
        return;
      }
      await runStage(
        () => exportGeneric({ cwd }),
        (r) => {
          console.error(
            `[ok] exported ${r.files.length} file(s) under .export/, manifest at ${r.manifest}`
          );
        }
      );
    });
}
