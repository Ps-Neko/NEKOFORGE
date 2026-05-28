import type { Command } from "commander";
import { runPacket, type PacketTool } from "../../core/packet/index.js";
import { buildDeps } from "../../core/stage-runner.js";
import { runDispatchAll } from "../../workers/dispatch.js";
import { runStage } from "./_run.js";

interface PacketOpts {
  dispatch?: boolean;
  profile?: string;
  tool?: string;
}

function parsePacketTool(raw: string | undefined): PacketTool {
  const tool = raw ?? "generic";
  if (tool === "generic" || tool === "codex" || tool === "claude" || tool === "cursor" || tool === "all") {
    return tool;
  }
  throw new Error(`invalid --tool "${tool}" (expected generic, codex, claude, cursor, or all)`);
}

export function registerPacket(program: Command): void {
  program
    .command("packet")
    .description("Build an AI work packet from project context and task evidence")
    .argument("<task-id>", "task id from .harness/TASKS.md")
    .option("--tool <name>", "generic | codex | claude | cursor | all", "generic")
    .option("--dispatch", "also generate worker prompts via dispatch --all", false)
    .option("--profile <name>", "minimal | standard | strict for --dispatch")
    .action(async (taskId: string, opts: PacketOpts) => {
      await runStage(
        async () => {
          const deps = buildDeps();
          const dispatch = opts.dispatch
            ? await runDispatchAll(
                {
                  taskId,
                  ...(opts.profile
                    ? { profile: opts.profile as "minimal" | "standard" | "strict" }
                    : {})
                },
                deps
              )
            : undefined;
          const packet = await runPacket(
            {
              taskId,
              tool: parsePacketTool(opts.tool),
              ...(dispatch ? { workerPrompts: dispatch.prompts } : {})
            },
            deps
          );
          return { packet, dispatch };
        },
        (r) => {
          console.error(`[ok] packet saved: ${r.packet.packetPath}`);
          for (const path of r.packet.packetPaths.slice(1)) {
            console.error(`[ok] packet saved: ${path}`);
          }
          if (r.dispatch) {
            console.error(`[ok] dispatched ${r.dispatch.prompts.length} prompt(s).`);
            console.error(`[ok] handoff: ${r.dispatch.handoffPath}`);
          }
          console.error(`[next] hand packet to AI worker, then run harness review && harness gate`);
        }
      );
    });
}
