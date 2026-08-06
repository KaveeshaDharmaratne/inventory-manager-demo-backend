import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const isDev = process.env.NODE_ENV !== 'production';
export type LogContext = string & { readonly _contextBrand: unique symbol };
export type StackTrace = string & { readonly _traceBrand: unique symbol };

function asLogContext(value: string): LogContext {
  return value as LogContext;
}

function asStackTrace(value: string): StackTrace {
  return value as StackTrace;
}

const consoleTransport =
  new winston.transports.Console({
    format: isDev
      ? winston.format.combine(
          winston.format.colorize({
            all: true,
          }),
          winston.format.timestamp({
            format: 'HH:mm:ss',
          }),
          winston.format.printf(
            ({
              level,
              message,
              timestamp,
              context,
              ...meta
            }) => {
              const ctx =
                typeof context === 'string'
                  ? `[${context}] `
                  : ''
              const rest =
                Object.keys(meta).length > 0
                  ? ` ${JSON.stringify(meta)}`
                  : ''
              return `${String(timestamp)} ${level} ${ctx}${String(message)}${rest}`
            },
          ),
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
  })

const transports: winston.transport[] = [
  consoleTransport,
]
// Use file logs only in persistent/container environments.
if (!process.env.VERCEL) {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  )
}

export const winstonLogger =
  winston.createLogger({
    level: isDev ? 'debug' : 'info',
    transports,
  })

type LogMeta = Record<string, unknown>;

function isLogMeta(value: unknown): value is LogMeta {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toEntry(message: unknown, context: LogContext | undefined): LogMeta {
  if (isLogMeta(message)) {
    return { ...message, context: context ?? message['context'] };
  }
  return { message, context };
}

export class NestLoggerAdapter implements LoggerService {
  private readonly context?: LogContext;
  constructor(context?: string) {
    this.context = context ? asLogContext(context) : undefined;
  }
  private resolveContext(override?: string): LogContext | undefined {
    return override !== undefined ? asLogContext(override) : this.context;
  }
  private resolveTrace(trace?: string): StackTrace | undefined {
    return trace !== undefined ? asStackTrace(trace) : undefined;
  }
  log(message: unknown, context?: string): void {
    winstonLogger.info(toEntry(message, this.resolveContext(context)));
  }
  error(message: unknown, trace?: string, context?: string): void {
    winstonLogger.error({
      ...toEntry(message, this.resolveContext(context)),
      trace: this.resolveTrace(trace),
    });
  }
  warn(message: unknown, context?: string): void {
    winstonLogger.warn(toEntry(message, this.resolveContext(context)));
  }
  debug(message: unknown, context?: string): void {
    winstonLogger.debug(toEntry(message, this.resolveContext(context)));
  }
  verbose(message: unknown, context?: string): void {
    winstonLogger.verbose(toEntry(message, this.resolveContext(context)));
  }
}

export function getLogger(context?: string): NestLoggerAdapter {
  return new NestLoggerAdapter(context);
}
