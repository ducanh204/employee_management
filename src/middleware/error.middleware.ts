import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ValidateError } from "tsoa";

import { AppError } from "@/errors/app-error";
import { logger } from "@/utils/logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Business errors explicitly thrown by services or middleware
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });

    return;
  }

  // 2. Zod validation errors
  // Handles cases where the request does not go through the validate() middleware
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid input data",
        details: err.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
    });

    return;
  }

  // 3. Tsoa validation errors
  // These are automatically generated from decorators such as @Body(), @Query(), etc.
  if (err instanceof ValidateError) {
    res.status(422).json({
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: err.fields,
      },
    });

    return;
  }

  // 4. Unexpected errors
  // Log full details for debugging, but do NOT expose internal details to the client
  logger.error("Unhandled error", {
    error: err instanceof Error ? err.stack : err,
    path: req.path,
  });

  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      details: null,
    },
  });
}