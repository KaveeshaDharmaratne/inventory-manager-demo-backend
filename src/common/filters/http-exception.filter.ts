import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as util from 'util';
import { getLogger } from '../logger/winston.logger';

interface ResolvedError {
  status: number;
  error: string;
  message: string;
  errors: Array<{ field?: string; message: string }>;
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitiveLike(value: unknown): value is number | boolean | bigint {
  const t = typeof value;
  return t === 'number' || t === 'boolean' || t === 'bigint';
}

export function safeString(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'symbol') return value.toString();
  if (isPrimitiveLike(value)) return String(value);
  return util.inspect(value, { depth: 2 });
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = getLogger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ||
      (request.headers['x-correlation-id'] as string | undefined) ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const resolved = this.resolveException(exception);
    const stack = this.extractStack(exception);

    this.logger.error(
      {
        requestId,
        path: request.url,
        method: request.method,
        status: resolved.status,
        message: safeString(exception),
      },
      stack,
    );

    response.status(resolved.status).json({
      statusCode: resolved.status,
      error: resolved.error,
      message: resolved.message,
      errors: resolved.errors,
      requestId,
    });
  }

  private resolveException(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }
    if (isPlainObject(exception)) {
      return this.resolveDbOrGenericError(exception);
    }
    const message =
      typeof exception === 'string' ? exception : 'Internal Server Error';
    return this.internalError(message);
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    let error: string = HttpStatus[status] ?? 'Error';
    let message = 'An error occurred';
    let errors: Array<{ field?: string; message: string }> = [];

    const resp = exception.getResponse();
    if (typeof resp === 'string') {
      message = resp;
    } else if (isPlainObject(resp)) {
      const body = resp;
      const maybeError = body.error;
      if (typeof maybeError === 'string' && maybeError.length > 0) {
        error = maybeError;
      }
      ({ message, errors } = this.extractMessageAndErrors(
        body.message,
        message,
        errors,
      ));
    }

    return { status, error, message, errors };
  }

  private extractMessageAndErrors(
    maybeMessage: unknown,
    defaultMessage: string,
    defaultErrors: Array<{ field?: string; message: string }>,
  ): { message: string; errors: Array<{ field?: string; message: string }> } {
    if (typeof maybeMessage === 'string') {
      return { message: maybeMessage, errors: defaultErrors };
    }
    if (Array.isArray(maybeMessage)) {
      const errors = maybeMessage.map((m) => ({ message: String(m) }));
      return { message: 'Validation failed', errors };
    }
    if (isPlainObject(maybeMessage)) {
      return { message: safeString(maybeMessage), errors: defaultErrors };
    }
    return { message: defaultMessage, errors: defaultErrors };
  }

  private resolveDbOrGenericError(
    exception: Record<string, unknown>,
  ): ResolvedError {
    const code =
      typeof exception['code'] === 'string' ? exception['code'] : undefined;
    const detail = exception['detail'];

    if (code === '23505') {
      const message =
        typeof detail === 'string' ? detail : 'Unique constraint violation';
      return {
        status: HttpStatus.CONFLICT,
        error: 'Conflict',
        message,
        errors: [{ message }],
      };
    }
    if (code === '23503') {
      const message =
        typeof detail === 'string' ? detail : 'Foreign key violation';
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message,
        errors: [{ message }],
      };
    }
    if (exception instanceof Error) {
      return this.internalError(exception.message);
    }
    return this.internalError('Internal Server Error');
  }

  private internalError(message: string): ResolvedError {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message,
      errors: [],
    };
  }

  private extractStack(exception: unknown): string | undefined {
    if (exception && typeof exception === 'object' && 'stack' in exception) {
      const s = (exception as Record<string, unknown>)['stack'];
      if (typeof s === 'string') return s;
    }
    return undefined;
  }
}
