/**
 * 결정성 위해 외부에서 clock 주입 가능. 시스템 사용 시 systemClock 기본.
 */

export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function isoNow(clock: Clock = systemClock): string {
  return clock().toISOString();
}
