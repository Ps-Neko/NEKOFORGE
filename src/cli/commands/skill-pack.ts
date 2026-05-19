/**
 * harness skill-pack <subcommand> — Phase RP.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  disableSkillPack,
  enableSkillPack,
  ensureSkillPacks,
  getSkillPackStatus,
  listSkillPackCatalog
} from "../../skill-packs/index.js";
import { runStage } from "./_run.js";

export function registerSkillPack(program: Command): void {
  const cmd = program
    .command("skill-pack")
    .description("Skill pack commands (list/enable/disable/status/audit)");

  cmd
    .command("list")
    .description("List skill pack catalog")
    .action(() => {
      for (const p of listSkillPackCatalog()) {
        console.error(`- ${p.id} (${p.appliesTo})`);
      }
    });

  cmd
    .command("enable")
    .description("Enable a skill pack")
    .argument("<pack>", "skill pack id")
    .action(async (pack: string) => {
      await runStage(
        () => enableSkillPack(pack, buildDeps()),
        (r) =>
          console.error(`[ok] enabled. now: ${r.enabledPacks.join(", ")}`)
      );
    });

  cmd
    .command("disable")
    .description("Disable a skill pack")
    .argument("<pack>", "skill pack id")
    .action(async (pack: string) => {
      await runStage(
        () => disableSkillPack(pack, buildDeps()),
        (r) =>
          console.error(`[ok] disabled. now: ${r.enabledPacks.join(", ")}`)
      );
    });

  cmd
    .command("status")
    .description("Show enabled / disabled / template recommendations")
    .action(async () => {
      const s = await getSkillPackStatus(buildDeps());
      console.error(`configured: ${s.configured}`);
      console.error(`enabled: ${s.enabledPacks.join(", ") || "(none)"}`);
      console.error(`disabled: ${s.disabledPacks.join(", ") || "(none)"}`);
      if (s.unknownEnabled.length > 0) {
        console.error(`unknown enabled: ${s.unknownEnabled.join(", ")}`);
      }
      console.error(`template recommendations:`);
      for (const [tpl, packs] of Object.entries(s.templateRecommendations)) {
        console.error(`  ${tpl}: ${packs.join(", ")}`);
      }
    });

  cmd
    .command("audit")
    .description("Ensure skill-packs.json exists with defaults if missing")
    .action(async () => {
      const r = await ensureSkillPacks(buildDeps());
      console.error(`[ok] skill-packs.json present. enabled: ${r.enabledPacks.join(", ")}`);
    });
}
