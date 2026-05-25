/**
 * Phase WF-3 prototype — Worker Adapter interface (stub only, no auto-spawn).
 *
 * 본 모듈은 인터페이스 정의만 한다. 실제 LLM 자동 실행은 의도적으로 미구현.
 * 사용자가 명시적으로 호출 (`harness dispatch --adapter shell --command ...`)
 * 한 경우에만 동작.
 *
 * 비-목표:
 *   - 무인 autonomous loop
 *   - background long-running runtime
 *   - tmux/screen 통합
 *   - 외부 SaaS API key 자동 로드
 */
import type { WorkerRole } from "./types.js";

export interface WorkerAdapterInput {
  role: WorkerRole;
  prompt: string;
  taskId: string;
}

export interface WorkerAdapterResult {
  status: "completed" | "failed" | "skipped" | "needs_input";
  resultMd: string;
  exitCode?: number;
  notes?: string;
}

export interface WorkerAdapter {
  readonly id: string;
  available(): Promise<boolean>;
  dispatch(input: WorkerAdapterInput): Promise<WorkerAdapterResult>;
}

/**
 * shellWorkerAdapter — 사용자가 명시 호출한 shell command 의 stdout 을 result 로 캡처.
 * 본 stub 은 실제 spawn 호출 없이 인터페이스만 검증. 진짜 사용 시 사용자가
 * 명시 가드 (`--allow-shell`) 와 함께 호출.
 */
export function createShellWorkerAdapterStub(): WorkerAdapter {
  return {
    id: "shell-stub",
    async available() {
      return true;
    },
    async dispatch(input) {
      return {
        status: "skipped",
        resultMd:
          `# ${input.role} — shell adapter stub\n\n` +
          `본 stub 은 실제 명령을 실행하지 않습니다. Phase WF-3 진입 시\n` +
          `사용자 명시 가드 (--allow-shell) 와 함께 활성화 예정.\n\n` +
          `prompt 경로: .harness/worker-runs/${input.taskId}/${input.role}.prompt.md`,
        notes: "stub — no actual spawn"
      };
    }
  };
}

/** 외부에서 어댑터를 등록해 순환 의존성 없이 resolver 를 확장한다. */
const _registry = new Map<string, () => WorkerAdapter>();

export function registerWorkerAdapter(id: string, factory: () => WorkerAdapter): void {
  _registry.set(id, factory);
}

/**
 * adapter resolver — 미래 어댑터 등록 지점.
 * shell/shell-stub 는 내장. claude 등 추가 어댑터는 registerWorkerAdapter 로 등록.
 */
export function resolveWorkerAdapter(id: string): WorkerAdapter | null {
  if (id === "shell" || id === "shell-stub") {
    return createShellWorkerAdapterStub();
  }
  const factory = _registry.get(id);
  return factory ? factory() : null;
}
