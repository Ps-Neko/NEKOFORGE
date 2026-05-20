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
    .description(
      "Ensure skill-packs.json + report template coverage (recommended)"
    )
    .action(async () => {
      const deps = buildDeps();
      const r = await ensureSkillPacks(deps);
      const s = await getSkillPackStatus(deps);
      console.error(`[ok] skill-packs.json present.`);
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
        const recommended = s.templateRecommendations[tpl] ?? [];
        const missing = recommended.filter((p) => !s.enabledPacks.includes(p));
        console.error(`template: ${tpl}`);
        console.error(`recommended: ${recommended.join(", ") || "(none)"}`);
        if (missing.length > 0) {
          console.error(`[warn] missing recommended: ${missing.join(", ")}`);
          for (const m of missing) {
            console.error(`       fix: harness skill-pack enable ${m}`);
          }
        } else {
          console.error(`[ok] template recommendation complete.`);
        }
      } else {
        console.error(
          `[note] no quality-contract.json — run \`harness contract --template <name>\` for template-aware recommendation check.`
        );
      }
    });
}
