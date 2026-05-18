/**
 * 각 명령의 공통 try/catch 래퍼. err.exitCode 가 있으면 그 코드로 process.exit.
 */
export async function runStage<T>(
  fn: () => Promise<T>,
  onSuccess: (r: T) => void
): Promise<void> {
  try {
    const r = await fn();
    onSuccess(r);
  } catch (err) {
    const e = err as Error & { exitCode?: number };
    console.error(`[error] ${e.message}`);
    process.exit(e.exitCode ?? 1);
  }
}
