import type { NextFunction, Request, Response } from 'express';

export function jsonErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!err) {
    next();
    return;
  }
  const errRecord =
    typeof err === 'object' && err !== null
      ? (err as { status?: number; type?: string })
      : {};
  const status = errRecord.status;
  const type = errRecord.type;
  if (status === 413 || type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request payload is too large. Please shorten your message.',
      code: 'PAYLOAD_TOO_LARGE',
    });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({
      error: 'Invalid JSON request body.',
      code: 'INVALID_JSON',
    });
    return;
  }
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
