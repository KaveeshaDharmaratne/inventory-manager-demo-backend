import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../logger/winston.logger';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req.headers['x-correlation-id'] as string | undefined) ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    res.on('finish', () => {
      const entry = {
        context: 'HTTP',
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      };
      if (res.statusCode >= 500) winstonLogger.error(entry);
      else if (res.statusCode >= 400) winstonLogger.warn(entry);
      else winstonLogger.info(entry);
    });
    next();
  }
}
