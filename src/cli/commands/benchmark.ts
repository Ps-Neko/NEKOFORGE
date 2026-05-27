import type { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveWorkspaceCwd } from "../../core/stage-runner.js";
import { runBenchmarkWithRules, renderBenchmarkMd } from "../../benchmark/index.js";
import { harnessRoot } from "../../utils/paths.js";
import { loadActiveRules } from "../../core/promotion/promoted.js";
import type { PromotedManifest } from "../../core/promotion/store-types.js";

interface BenchmarkOpts {
  group?: string;
  fixtures?: string;
  json?: boolean;
}

export function registerBenchmark(program: Command): void {
  program
    .command("benchmark")
    .description(
      "Run fixture benchmark from `fixtures/` directory (Phase QF — QF-012)"
    )
    .option("--group <name>", "run only the given group (security/architecture/design/apply/codex)")
    .option("--fixtures <path>", "fixtures root", "fixtures")
    .option("--json", "machine output to stdout")
    .action(async (opts: BenchmarkOpts) => {
      const cwd = resolveWorkspaceCwd();
      const root = join(cwd, opts.fixtures ?? "fixtures");
      try {
        const readManifest = async (): Promise<PromotedManifest | null> => {
          try {
            return JSON.parse(
              await readFile(join(harnessRoot(cwd), "promotions", "promoted.json"), "utf8")
            ) as PromotedManifest;
          } catch {
            return null;
          }
        };
        const active = await loadActiveRules(readManifest);
        const r = await runBenchmarkWithRules(root, active, opts.group);
        const hroot = harnessRoot(cwd);
        await mkdir(hroot, { recursive: true });
        await writeFile(join(hroot, "benchmark-results.json"), JSON.stringify(r, null, 2), "utf8");
        await writeFile(join(hroot, "benchmark-report.md"), renderBenchmarkMd(r), "utf8");
        if (opts.json) {
          process.stdout.write(JSON.stringify(r) + "\n");
        } else {
          console.error(
            `[ok] ${r.passed}/${r.totalScenarios} scenarios passed (critical recall=${r.criticalRecall.toFixed(2)}, fp rate=${r.falsePositiveRate.toFixed(2)})`
          );
          console.error(`[log] .harness/benchmark-report.md`);
        }
      } catch (err) {
        console.error(`[error] ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
