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


/**
 * Converts Multer/parser failures into stable, non-sensitive API responses.
 * Unknown failures are deliberately generic so internal paths/details are not
 * reflected to callers.
 */
export function normalizeContractUploadError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
} | null {
  if (!error) return null;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code === 'UNSUPPORTED_FILE_TYPE') {
    return {
      statusCode: 415,
      code: 'UPLOAD_FILE_TYPE_NOT_ALLOWED',
      message: 'Jenis file tidak diizinkan. Gunakan PDF, JPG, PNG, DOC, atau DOCX.',
    };
  }
  if (code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 413,
      code: 'UPLOAD_FILE_TOO_LARGE',
      message: 'Ukuran file melebihi batas 10 MB.',
    };
  }
  if (code.startsWith('LIMIT_')) {
    return {
      statusCode: 400,
      code: 'INVALID_UPLOAD_REQUEST',
      message: 'Format unggahan tidak valid atau melewati batas jumlah bagian.',
    };
  }
  return {
    statusCode: 500,
    code: 'UPLOAD_PROCESSING_FAILED',
    message: 'Unggahan gagal diproses. Silakan coba kembali.',
  };
}
