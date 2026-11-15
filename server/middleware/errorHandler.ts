import type { NextFunction, Request, Response } from 'express';

function logOperationalError(req: Request, status: number, code: string): void {
  // Log only structural metadata — never log request body, API keys, or user messages
  console.error('[api-error]', {
    method: req.method,
    path: req.path,
    status,
    code,
  });
}

export function jsonErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!err) {
    next();
    return;
  }
  if (res.headersSent) {
    next(err);
    return;
  }
  const errRecord =
    typeof err === 'object' && err !== null
      ? (err as { status?: number; type?: string })
      : {};
  const status = errRecord.status;
  const type = errRecord.type;
  if (status === 413 || type === 'entity.too.large') {
    logOperationalError(req, 413, 'PAYLOAD_TOO_LARGE');
    res.status(413).json({
      error: 'Request payload is too large. Please shorten your message.',
      code: 'PAYLOAD_TOO_LARGE',
    });
    return;
  }
  if (err instanceof SyntaxError) {
    logOperationalError(req, 400, 'INVALID_JSON');
    res.status(400).json({
      error: 'Invalid JSON request body.',
      code: 'INVALID_JSON',
    });
    return;
  }
  logOperationalError(req, 500, 'SERVER_ERROR');
  res.status(500).json({
    error: 'Unexpected server request error.',
    code: 'SERVER_ERROR',
  });
}

export function apiNotFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'API endpoint not found.',
    code: 'NOT_FOUND',
  });
}
