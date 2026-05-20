import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { runInit } from "../../core/init.js";
import { buildDeps, resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runWorkersInit, type WorkerProfile } from "../../workers/index.js";
import { ensureRulePacks } from "../../rule-packs/index.js";
import { ensureSkillPacks } from "../../skill-packs/index.js";
import { runQualityContract } from "../../core/quality-contract/index.js";
import { runStage } from "./_run.js";

type Preset = "cli-tool" | "web-ui" | "backend-api" | "library";

interface PresetMap {
  profile: WorkerProfile;
  contractTemplate: "cli-tool" | "web-ui" | "backend-api" | "library";
}

const PRESETS: Record<Preset, PresetMap> = {
  "cli-tool": { profile: "standard", contractTemplate: "cli-tool" },
  "web-ui": { profile: "strict", contractTemplate: "web-ui" },
  "backend-api": { profile: "strict", contractTemplate: "backend-api" },
  library: { profile: "standard", contractTemplate: "library" }
};

const DEFAULT_CONTRACT_ANSWERS = {
  user: "(누구) — replace with actual primary user",
  problem: "(해결할 문제) — replace with actual problem statement",
  coreValue: "(핵심 가치) — replace with actual value proposition"
};

interface InitOpts {
  force?: boolean;
  preset?: string;
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description(
      "Initialize .harness/ workspace (optionally with --preset for quick start)"
    )
    .option("--force", "overwrite existing .harness/")
    .option(
      "--preset <name>",
      "preset: cli-tool | web-ui | backend-api | library"
    )
    .action(async (opts: InitOpts) => {
      await runStage(
        async () => {
          const cwd = resolveWorkspaceCwd();
          const initResult = await runInit({
            force: opts.force === true,
            cwd
          });
          if (!opts.preset) {
            return { ...initResult, preset: null as null | Preset };
          }
          const preset = opts.preset as Preset;
          if (!PRESETS[preset]) {
            throw new Error(
              `unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(", ")}`
            );
          }
          const map = PRESETS[preset];
          const deps = buildDeps(cwd);
          await runWorkersInit(
            { profile: map.profile, force: true },
            deps
          );
          await ensureRulePacks(deps);
          await ensureSkillPacks(deps);
          const contractAnswers = join(
            tmpdir(),
            `nf-preset-contract-${Date.now()}.json`
          );
          await writeFile(
            contractAnswers,
            JSON.stringify(DEFAULT_CONTRACT_ANSWERS),
            "utf8"
          );
          await runQualityContract(
            {
              taskId: "TASK-001",
              template: map.contractTemplate,
              answersFile: contractAnswers
            },
            deps
          );
          return { ...initResult, preset };
        },
        (r) => {
          console.error(`[ok] ${r.harnessDir} created.`);
          if (r.preset) {
            const map = PRESETS[r.preset];
            console.error(
              `[ok] preset=${r.preset} applied: workers (profile=${map.profile}) + rule-packs + skill-packs + contract (template=${map.contractTemplate}, TASK-001).`
            );
            console.error(
              `[note] quality-contract.json 의 productIntent 는 placeholder. \`harness contract --template ${map.contractTemplate} --answers <file>\` 로 실 사용자/문제/가치 채우세요.`
            );
            console.error(`[next] harness work TASK-001`);
          } else {
            console.error(`[next] harness ask "<goal>"`);
          }
        }
      );
    });
}
