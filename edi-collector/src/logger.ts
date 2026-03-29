const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: string) {
  if (level in LOG_LEVELS) {
    currentLevel = level as LogLevel;
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  debug(msg: string) {
    if (shouldLog('debug')) console.log(`${timestamp()} [DEBUG] ${msg}`);
  },
  info(msg: string) {
    if (shouldLog('info')) console.log(`${timestamp()} [INFO]  ${msg}`);
  },
  warn(msg: string) {
    if (shouldLog('warn')) console.warn(`${timestamp()} [WARN]  ${msg}`);
  },
  error(msg: string) {
    if (shouldLog('error')) console.error(`${timestamp()} [ERROR] ${msg}`);
  },
};
