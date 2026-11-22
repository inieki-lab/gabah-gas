import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Bounds the number of in-flight memory-backed uploads in one app process.
 * Every terminal request path releases its slot exactly once (finish, close,
 * or aborted), including Multer/parser errors handled by Express.
 */
export function createUploadConcurrencyLimiter(
  maxConcurrent = 2,
  retryAfterSeconds = 10,
): RequestHandler {
  const capacity = Math.max(1, Math.floor(maxConcurrent));
  const retryAfter = Math.max(1, Math.floor(retryAfterSeconds));
  let active = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (active >= capacity) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(503).json({
        success: false,
        message: 'Server sedang menangani unggahan lain. Silakan coba kembali.',
        retry_after_seconds: retryAfter,
      });
      return;
    }

    active += 1;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };

    res.once('finish', release);
    res.once('close', release);
    req.once('aborted', release);
    next();
  };
}
