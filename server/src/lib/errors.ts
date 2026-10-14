import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../logger.js";

/** An error that is safe to show to the user, with an HTTP status code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = "bad_request") => new HttpError(400, msg, code);
export const unauthorized = (msg = "Please sign in to continue.") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to that.") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string, code = "conflict") => new HttpError(409, msg, code);

/**
 * Express 5 forwards errors thrown in async handlers here automatically.
 * Known errors become clean JSON; anything unexpected is logged and hidden
 * behind a generic message so internals never leak to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: { code: "validation", message: first?.message ?? "Invalid input.", field: first?.path.join(".") },
    });
    return;
  }
  // Multer and body-parser errors carry their own status.
  const status = typeof err?.status === "number" ? err.status : err?.code === "LIMIT_FILE_SIZE" ? 413 : 500;
  if (status < 500) {
    res.status(status).json({ error: { code: "bad_request", message: err.message ?? "Bad request." } });
    return;
  }
  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: { code: "internal", message: "Something went wrong on our side." } });
};
