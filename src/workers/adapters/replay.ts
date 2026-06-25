/**
 * 재생(replay) 워커 어댑터 — claude 를 spawn 하지 않고 *캡처된 AI 산출물*을 반환한다.
 * demo auto 의 결정적/오프라인 모드 전용. cost 0. (실제 코드 생성은 createClaudeWorkerAdapter.)
 */
import type { WorkerAdapter, WorkerAdapterInput, WorkerAdapterResult } from "../adapter.js";

export interface ReplayAdapterOptions {
  /** 데모에서 보여줄 워커 산출 요약(markdown). diff 자체는 runAuto 의 captureDiff 로 공급된다. */
  resultMd?: string;
}

export function createReplayWorkerAdapter(
  opts: ReplayAdapterOptions = {}
): WorkerAdapter & { estimateCostUsd: number } {
  const resultMd = opts.resultMd ?? "# replay worker\n\n캡처된 AI 작업을 재생합니다(실시간 호출 없음).";
  return {
    id: "replay",
    estimateCostUsd: 0,
    async available(): Promise<boolean> {
      return true;
    },
    async dispatch(_input: WorkerAdapterInput): Promise<WorkerAdapterResult> {
      return { status: "completed", resultMd, notes: "replay (no spawn)" };
    }
  };
}
