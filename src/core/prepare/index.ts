/**
 * runPrepare — `nekoforge prepare "<goal>"` 1-shot 생산성 entry point.
 *
 * intake + clarify + context(+source-map) + packet 을 한 번에 묶어, 사용자가
 * goal 한 줄만 주면 AI 도구에 바로 넘길 작업 패킷이 나오게 한다. 검증/Gate 흐름
 * (review → gate → apply) 은 그대로 별도 명령으로 남는다.
 *
 * orchestrator 성격이라 다른 core stage 를 자유롭게 조합한다(depcruise §1 예외).
 */
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { buildDeps } from "../stage-runner.js";
import { runInit } from "../init.js";
import { runIntake } from "../intake/index.js";
import { runClarify } from "../clarify/index.js";
import { runContext } from "../context/index.js";
import { runPacket, type PacketTool } from "../packet/index.js";

export interface PrepareInput {
  cwd: string;
  goal: string;
  taskId?: string;
  tool?: PacketTool;
}

export interface PrepareResult {
  taskId: string;
  packetPath: string;
  packetPaths: string[];
  intakePath: string;
  contextPath: string;
  sourceMapPath: string;
}

async function harnessInitialized(cwd: string): Promise<boolean> {
  try {
    const s = await stat(join(cwd, ".harness", "config.json"));
    return s.isFile();
  } catch {
    return false;
  }
}

export async function runPrepare(input: PrepareInput): Promise<PrepareResult> {
  if (!(await harnessInitialized(input.cwd))) {
    await runInit({ cwd: input.cwd });
  }

  const deps = buildDeps(input.cwd);
  const taskId = input.taskId ?? "TASK-001";

  await runIntake({ goal: input.goal, source: "prepare" }, deps);
  await runClarify(deps);
  const context = await runContext(deps);
  const packet = await runPacket({ taskId, tool: input.tool ?? "generic" }, deps);

  return {
    taskId,
    packetPath: packet.packetPath,
    packetPaths: packet.packetPaths,
    intakePath: ".harness/intake.md",
    contextPath: context.path,
    sourceMapPath: context.sourceMapPath
  };
}
