/**
 * harness rule-pack <subcommand> — Phase RP.
 */
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import {
  disableRulePack,
  enableRulePack,
  ensureRulePacks,
  getRulePackStatus,
  listRulePackCatalog
} from "../../rule-packs/index.js";
import { runStage } from "./_run.js";

export function registerRulePack(program: Command): void {
  const cmd = program
    .command("rule-pack")
    .description("Rule pack commands (list/enable/disable/status/audit)");

  cmd
    .command("list")
    .description("List rule pack catalog")
    .action(() => {
      for (const p of listRulePackCatalog()) {
        console.error(`- ${p.id} — ${p.describe}`);
      }
    });

  cmd
    .command("enable")
    .description("Enable a rule pack")
    .argument("<pack>", "rule pack id")
    .action(async (pack: string) => {
      await runStage(
        () => enableRulePack(pack, buildDeps()),
        (r) =>
          console.error(`[ok] enabled. now: ${r.enabledPacks.join(", ")}`)
      );
    });

  cmd
    .command("disable")
    .description("Disable a rule pack")
    .argument("<pack>", "rule pack id")
    .action(async (pack: string) => {
      await runStage(
        () => disableRulePack(pack, buildDeps()),
        (r) =>
          console.error(`[ok] disabled. now: ${r.enabledPacks.join(", ")}`)
      );
    });

  cmd
    .command("status")
    .description("Show enabled / disabled / template requirements")
    .action(async () => {
      const s = await getRulePackStatus(buildDeps());
      console.error(`configured: ${s.configured}`);
      console.error(`enabled: ${s.enabledPacks.join(", ") || "(none)"}`);
      console.error(`disabled: ${s.disabledPacks.join(", ") || "(none)"}`);
      if (s.unknownEnabled.length > 0) {
        console.error(`unknown enabled: ${s.unknownEnabled.join(", ")}`);
      }
      console.error(`template requirements:`);
      for (const [tpl, packs] of Object.entries(s.templateRequirements)) {
        console.error(`  ${tpl}: ${packs.join(", ")}`);
      }
    });

  cmd
    .command("audit")
    .description("Ensure rule-packs.json exists with defaults if missing")
    .action(async () => {
      const r = await ensureRulePacks(buildDeps());
      console.error(`[ok] rule-packs.json present. enabled: ${r.enabledPacks.join(", ")}`);
    });
}
