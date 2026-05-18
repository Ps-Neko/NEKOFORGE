/**
 * 사람용 출력을 위한 얇은 logger. quiet · no-color · json 옵션 준수.
 * 색 코드는 picocolors 가 있어도 환경 변수에 따라 비활성될 수 있다.
 */
import pc from "picocolors";

export interface LoggerOptions {
  quiet?: boolean;
  color?: boolean;
  json?: boolean;
}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  ok(msg: string): void;
  json(payload: unknown): void;
  isJson(): boolean;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const useColor = opts.color !== false && process.stdout.isTTY === true;
  const c = useColor
    ? pc
    : ({ green: (s: string) => s, yellow: (s: string) => s, red: (s: string) => s, gray: (s: string) => s });

  return {
    info(msg) {
      if (opts.quiet || opts.json) return;
      console.error(c.gray(`[info] ${msg}`));
    },
    warn(msg) {
      if (opts.json) return;
      console.error(c.yellow(`[warn] ${msg}`));
    },
    error(msg) {
      console.error(c.red(`[error] ${msg}`));
    },
    ok(msg) {
      if (opts.quiet || opts.json) return;
      console.error(c.green(`[ok] ${msg}`));
    },
    json(payload) {
      if (!opts.json) return;
      process.stdout.write(JSON.stringify(payload) + "\n");
    },
    isJson() {
      return opts.json === true;
    }
  };
}
