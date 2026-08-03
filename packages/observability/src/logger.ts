import { redact } from './redact';

/**
 * Structured logger — the only sanctioned output path.
 *
 * Every value passes through the scrubber before it reaches stdout, so a
 * careless `logger.info('pull failed', { business })` cannot leak an EIN. The
 * eslint config bans bare `console` to keep this the path of least resistance.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that merges `bindings` into every subsequent line. */
  child(bindings: LogContext): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  /** Injectable for tests; defaults to stdout/stderr. */
  sink?: (line: string, level: LogLevel) => void;
}

function defaultSink(line: string, level: LogLevel): void {
  // Written to the streams directly rather than through `console`, which the
  // eslint config bans to keep this module the only output path.
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
  const sink = options.sink ?? defaultSink;
  const service = options.service ?? 'app';

  function emit(entryLevel: LogLevel, bindings: LogContext, message: string, context?: LogContext) {
    if (LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) return;
    const record = {
      ts: new Date().toISOString(),
      level: entryLevel,
      service,
      msg: message,
      ...bindings,
      ...(context ?? {}),
    };
    let line: string;
    try {
      line = JSON.stringify(redact(record));
    } catch {
      line = JSON.stringify({ ts: new Date().toISOString(), level: 'error', service, msg: 'log serialization failed' });
    }
    sink(line, entryLevel);
  }

  function build(bindings: LogContext): Logger {
    return {
      debug: (m, c) => emit('debug', bindings, m, c),
      info: (m, c) => emit('info', bindings, m, c),
      warn: (m, c) => emit('warn', bindings, m, c),
      error: (m, c) => emit('error', bindings, m, c),
      child: (extra) => build({ ...bindings, ...extra }),
    };
  }

  return build({});
}

export const logger = createLogger();
