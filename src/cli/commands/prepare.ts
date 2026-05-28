import type { Command } from "commander";
import { runPrepare } from "../../core/prepare/index.js";
import type { PacketTool } from "../../core/packet/index.js";
import { resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runStage } from "./_run.js";

interface PrepareOpts {
  tool?: string;
  taskId?: string;
}

function parsePacketTool(raw: string | undefined): PacketTool {
  const tool = raw ?? "generic";
  if (tool === "generic" || tool === "codex" || tool === "claude" || tool === "cursor" || tool === "all") {
    return tool;
  }
  throw new Error(`invalid --tool "${tool}" (expected generic, codex, claude, cursor, or all)`);
}

export function registerPrepare(program: Command): void {
  program
    .command("prepare")
    .description(
      "Prepare an AI work packet from a single goal. " +
        "Runs intake → clarify → context (+source-map) → packet in one shot."
    )
    .argument("<goal>", "task goal as a single string (quote it on the shell)")
    .option("--tool <name>", "generic | codex | claude | cursor | all", "generic")
    .option("--task-id <id>", "explicit task id (default: TASK-001)")
    .action(async (goal: string, opts: PrepareOpts) => {
      await runStage(
        async () => {
          const cwd = resolveWorkspaceCwd();
          return runPrepare({
            cwd,
            goal,
            tool: parsePacketTool(opts.tool),
            ...(opts.taskId ? { taskId: opts.taskId } : {})
          });
        },
        (r) => {
          console.error(`[ok] intake:    ${r.intakePath}`);
          console.error(`[ok] context:   ${r.contextPath}`);
          console.error(`[ok] source-map: ${r.sourceMapPath}`);
          for (const path of r.packetPaths) {
            console.error(`[ok] packet:    ${path}`);
          }
          console.error(`[next] hand the packet to your AI tool, then run harness review && harness gate`);
        }
      );
    });
}
