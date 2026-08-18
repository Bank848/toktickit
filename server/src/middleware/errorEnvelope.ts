import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface FieldError {
  field: string;
  message: string;
}

export class HttpError extends Error {
  status: number;
  code: string;
  fieldErrors: FieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationHttpError extends HttpError {
  constructor(fieldErrors: FieldError[]) {
    super(422, 'VALIDATION_FAILED', 'One or more fields are invalid', fieldErrors);
  }
}

export function correlationId(req: Request, _res: Response, next: NextFunction) {
  (req as Request & { correlationId: string }).correlationId = randomUUID();
  next();
}

export function errorEnvelope(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  const id = (req as Request & { correlationId?: string }).correlationId ?? 'unknown';

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors, correlationId: id },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', fieldErrors: [], correlationId: id },
  });
}
