import { Request, Response, NextFunction } from "express";

// ── Custom App Error ──────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public error: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── 404 Handler ───────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} does not exist`,
    statusCode: 404,
  });
}

// ── Global Error Handler ──────────────────────────────────────

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Already handled / headers sent
  if (res.headersSent) return;

  const isDev = process.env.NODE_ENV === "development";

  // AppError — known errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.error,
      message: err.message,
      statusCode: err.statusCode,
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // Zod validation errors are handled per-controller, but catch any leaks
  if (err instanceof Error && err.name === "ZodError") {
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      statusCode: 400,
    });
    return;
  }

  // PostgreSQL errors
  if (typeof err === "object" && err !== null && "code" in err) {
    const pgErr = err as { code: string; detail?: string };

    if (pgErr.code === "23505") {
      // Unique violation
      res.status(409).json({
        success: false,
        error: "CONFLICT",
        message: "A record with those details already exists",
        statusCode: 409,
        ...(isDev && { detail: pgErr.detail }),
      });
      return;
    }

    if (pgErr.code === "23503") {
      // Foreign key violation
      res.status(400).json({
        success: false,
        error: "REFERENCE_ERROR",
        message: "Referenced record does not exist",
        statusCode: 400,
      });
      return;
    }
  }

  // Errors with explicit statusCode (thrown from services)
  if (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    "message" in err
  ) {
    const e = err as { statusCode: number; message: string };
    res.status(e.statusCode).json({
      success: false,
      error: "REQUEST_ERROR",
      message: e.message,
      statusCode: e.statusCode,
    });
    return;
  }

  // Unknown errors
  if (isDev) {
    console.error("Unhandled error:", err);
  }

  res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
    ...(isDev && { detail: String(err) }),
  });
}
