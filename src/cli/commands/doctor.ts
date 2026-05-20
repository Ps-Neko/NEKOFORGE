/**
 * harness doctor — Phase UX 9점화.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Command } from "commander";
import { buildDeps } from "../../core/stage-runner.js";
import { runDoctor, renderDoctorMd } from "../../core/doctor/index.js";
import { runStage } from "./_run.js";

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose environment + .harness/ workspace (Phase UX)")
    .option("--json", "machine-readable JSON to stdout", false)
    .action(async (opts: { json?: boolean }) => {
      await runStage(
        async () => {
          const deps = buildDeps();
          const report = await runDoctor(deps);
          // .harness 가 있을 때만 보고서 저장.
          const { stat, mkdir } = await import("node:fs/promises");
          let harnessExists = false;
          try {
            await stat(join(deps.cwd, ".harness"));
            harnessExists = true;
          } catch {
            harnessExists = false;
          }
          if (harnessExists) {
            await mkdir(join(deps.cwd, ".harness"), { recursive: true });
            await writeFile(
              join(deps.cwd, ".harness", "doctor-report.json"),
              JSON.stringify(report, null, 2),
              "utf8"
            );
            await writeFile(
              join(deps.cwd, ".harness", "doctor-report.md"),
              renderDoctorMd(report),
              "utf8"
            );
          }
          return report;
        },
        (r) => {
          if (opts.json) {
            process.stdout.write(JSON.stringify(r) + "\n");
            return;
          }
          for (const c of r.checks) {
            const tag = c.status === "ok" ? "[ok]" : c.status === "warn" ? "[warn]" : "[error]";
            console.error(`${tag} ${c.id}: ${c.message}`);
            if (c.fix) console.error(`       fix: ${c.fix}`);
          }
          const next = r.checks.find((c) => c.fix);
          if (next) {
            console.error(`[next] ${next.fix}`);
          } else {
            console.error(`[next] all checks ok`);
          }
        }
      );
    });
}
