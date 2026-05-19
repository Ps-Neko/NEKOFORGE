#!/usr/bin/env node
/**
 * Verified AI Development Harness — CLI entry point.
 *
 * Phase B M1: 14 명령을 commander 에 등록하고 --help / --version 응답을 보장한다.
 * 각 명령의 실제 동작은 M2 이후 core/<stage>/ 모듈에서 채워진다.
 *
 * 본 파일은 다른 core 모듈을 직접 import 하지 않는다. (ARCHITECTURE.md §7)
 */
import { Command } from "commander";

import { registerInit } from "./commands/init.js";
import { registerAsk } from "./commands/ask.js";
import { registerContext } from "./commands/context.js";
import { registerSpec } from "./commands/spec.js";
import { registerPlan } from "./commands/plan.js";
import { registerDesign } from "./commands/design.js";
import { registerPolicy } from "./commands/policy.js";
import { registerTeam } from "./commands/team.js";
import { registerWork } from "./commands/work.js";
import { registerReview } from "./commands/review.js";
import { registerGate } from "./commands/gate.js";
import { registerApply } from "./commands/apply.js";
import { registerReport } from "./commands/report.js";
import { registerExport } from "./commands/export.js";
import { registerMemory } from "./commands/memory.js";
import { registerContract } from "./commands/contract.js";
import { registerBenchmark } from "./commands/benchmark.js";
import { registerRun } from "./commands/run.js";
import { appendAuditEvent, appendAuditEventSync } from "../utils/audit.js";
import { resolveWorkspaceCwd } from "../core/stage-runner.js";

const VERSION = "0.3.0-alpha.0";

function buildProgram(): Command {
  const program = new Command();

  program
    .name("harness")
    .description(
      "Verified AI Development Harness — local-first verified gate, deterministic rules, Human Gate, explicit apply."
    )
    .version(VERSION, "--version", "print version");

  program
    .option("--workspace <path>", "override .harness/ location")
    .option("--json", "machine-readable output")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable colored output");

  registerInit(program);
  registerAsk(program);
  registerContext(program);
  registerSpec(program);
  registerPlan(program);
  registerDesign(program);
  registerPolicy(program);
  registerTeam(program);
  registerWork(program);
  registerReview(program);
  registerGate(program);
  registerApply(program);
  registerReport(program);
  registerExport(program);
  registerMemory(program);
  registerContract(program);
  registerBenchmark(program);
  registerRun(program);

  program.showHelpAfterError(
    "(run `harness <command> --help` for command-specific help)"
  );

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  const argv = process.argv.slice(2);
  const cmdName = argv.find((x) => !x.startsWith("-")) ?? "(none)";

  // --workspace 우선. commander 가 옵션 파싱 후 hook 발화 전이라 직접 파싱한다.
  const { resolve } = await import("node:path");
  const wsIdx = argv.findIndex((a) => a === "--workspace");
  if (wsIdx >= 0 && argv[wsIdx + 1]) {
    process.env.HARNESS_WORKSPACE = resolve(argv[wsIdx + 1]!);
  }
  const workspaceCwd = resolveWorkspaceCwd();

  await appendAuditEvent(
    { type: "command_start", command: cmdName, argv, cwd: workspaceCwd },
    workspaceCwd
  );

  process.on("exit", (code) => {
    appendAuditEventSync(
      { type: "command_end", command: cmdName, exitCode: code },
      workspaceCwd
    );
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }
}

main();
