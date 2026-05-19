/**
 * harness run --mode fast/safe/release (Phase QF — QF-013).
 *
 * 본 명령은 사용자의 14단계 호출 순서를 안내하는 wrapper.
 * 실제 강제력은 각 stage 명령 자체의 거부 로직에 있다.
 * - fast : ask + plan + contract + work + review + gate (spec/context/design/policy/team 생략)
 * - safe : 풀 14단계
 * - release : safe + benchmark smoke (PASS 전 강제)
 *
 * 단, fast 도 quality-contract 가 spec 의 7문항(productIntent)을 흡수해 정체성 유지.
 * auth/secret/CI/deploy 변경 감지 시 자동 승격(detect at gate, not here).
 */
import type { Command } from "commander";

type Mode = "fast" | "safe" | "release";

const STEPS: Record<Mode, string[]> = {
  fast: [
    "harness init",
    "harness ask \"<goal>\"",
    "harness plan",
    "harness contract --template <web-ui|cli-tool|backend-api|library>",
    "# (직접 코드 변경)",
    "harness work TASK-001",
    "harness review",
    "harness gate",
    "harness apply --approved"
  ],
  safe: [
    "harness init",
    "harness ask \"<goal>\"",
    "harness context",
    "harness spec --answers spec-answers.json",
    "harness plan",
    "harness design --pattern Producer-Reviewer",
    "harness policy",
    "harness team",
    "harness contract --template <web-ui|cli-tool|backend-api|library>",
    "# (직접 코드 변경)",
    "harness work TASK-001",
    "harness review --adapter codex",
    "harness gate",
    "harness apply --approved",
    "harness report"
  ],
  release: [
    "# (safe 흐름 전체 +)",
    "harness benchmark --group security",
    "harness benchmark --group architecture",
    "harness benchmark   # full",
    "# benchmark report 검토 후 release 진행"
  ]
};

interface RunOpts {
  mode?: string;
}

export function registerRun(program: Command): void {
  program
    .command("run")
    .description(
      "Print the recommended command sequence for a given mode (Phase QF — QF-013)"
    )
    .argument("[goal]", "user goal (informational)")
    .option("--mode <name>", "fast | safe | release", "safe")
    .action(async (goal: string | undefined, opts: RunOpts) => {
      const mode = (opts.mode ?? "safe") as Mode;
      if (!STEPS[mode]) {
        console.error(`[error] unknown mode: ${mode}`);
        process.exit(1);
      }
      console.error(`# nekoforge run --mode ${mode}`);
      if (goal) console.error(`# goal: ${goal}`);
      console.error(`#`);
      console.error(`# 정책:`);
      console.error(`# - fast 도 quality-contract 는 생략 불가 (spec 7문항을 contract 가 흡수)`);
      console.error(`# - auth/secret/CI/deploy 변경 감지 시 gate 가 자동 NEEDS_HUMAN_REVIEW`);
      console.error(`# - release 는 benchmark smoke 없이 PASS 불가`);
      console.error(`#`);
      for (const s of STEPS[mode]) {
        console.error(s);
      }
    });
}
