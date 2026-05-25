/**
 * auto 비용 가드 — AI 호출 누적이 maxUsd 를 넘길 것 같으면 호출 *전*에 차단.
 * WF-3 §5(LLM spawn 비용 가드). 추정은 보수적(상한)으로.
 */
export class CostExceededError extends Error {
  readonly exitCode = 5;
  constructor(message: string) {
    super(message);
    this.name = "CostExceededError";
  }
}

export interface CostGuard {
  /** estUsd 를 더하면 maxUsd 초과인지 검사. 초과면 throw. */
  assertCanSpend(estUsd: number): void;
  /** 실제 지출 누적. */
  record(actualUsd: number): void;
  /** 현재까지 누적 지출. */
  spent(): number;
}

export function createCostGuard(maxUsd: number): CostGuard {
  let total = 0;
  return {
    assertCanSpend(estUsd: number): void {
      if (total + estUsd > maxUsd) {
        throw new CostExceededError(
          `예상 비용 $${(total + estUsd).toFixed(2)} 가 상한 $${maxUsd.toFixed(2)} 초과 (현재 지출 $${total.toFixed(2)}). 호출 중단.`
        );
      }
    },
    record(actualUsd: number): void {
      total += actualUsd;
    },
    spent(): number {
      return total;
    }
  };
}
