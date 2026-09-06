import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../errors/app-error";

type Source = "body" | "query" | "params";

/**
 * Tsoa does not automatically run Zod validation.
 * It only validates data types at the TypeScript type level.
 *
 * This middleware is responsible for validating actual business rules
 * such as minimum length, regex patterns, and other constraints
 * before the request is processed.
 */
export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      throw new BadRequestError("Invalid input data", details);
    }

    // Replace the request data with the parsed result.
    // This includes coerced types and applied default values.
    req[source] = result.data;

    next();
  };
}