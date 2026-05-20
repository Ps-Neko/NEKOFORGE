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
    .description(
      "Ensure rule-packs.json + report coverage (template / unknown / disabled / recommended)"
    )
    .action(async () => {
      const deps = buildDeps();
      const r = await ensureRulePacks(deps);
      const s = await getRulePackStatus(deps);
      console.error(`[ok] rule-packs.json present.`);
      console.error(`enabled: ${r.enabledPacks.join(", ")}`);
      console.error(`disabled: ${(r.disabledPacks ?? []).join(", ") || "(none)"}`);
      if (s.unknownEnabled.length > 0) {
        console.error(`[warn] unknown enabled pack(s): ${s.unknownEnabled.join(", ")}`);
      }
      const contract = await deps.artifact
        .readJson<{ template?: string }>("quality-contract.json")
        .catch(() => null);
      const tpl = contract?.template;
      if (tpl) {
        const required = s.templateRequirements[tpl] ?? [];
        const missing = required.filter((p) => !s.enabledPacks.includes(p));
        const disabled = required.filter((p) => (r.disabledPacks ?? []).includes(p));
        console.error(`template: ${tpl}`);
        console.error(`required: ${required.join(", ") || "(none)"}`);
        if (missing.length > 0) {
          console.error(`[warn] missing required: ${missing.join(", ")}`);
          for (const m of missing) {
            console.error(`       fix: harness rule-pack enable ${m}`);
          }
        }
        if (disabled.length > 0) {
          console.error(`[error] disabled required: ${disabled.join(", ")}`);
        }
        if (missing.length === 0 && disabled.length === 0) {
          console.error(`[ok] template coverage complete.`);
        }
      } else {
        console.error(
          `[note] no quality-contract.json found — run \`harness contract --template <name>\` for template-aware coverage check.`
        );
      }
    });
}
