import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token.util";
import { UnauthorizedError } from "../errors/app-error";
import { AuthUser } from "../types/express";

/**
 * Kept separate from extractAuthUser(req) so it can be reused in places
 * that do not have access to the Express Request object — specifically
 * in tsoa controllers, where the @Request() decorator causes metadata
 * generation issues in the current environment (see the note in
 * tsoaAuthentication.ts).
 *
 * The controller uses @Header("authorization") to retrieve the raw
 * Authorization header and calls this function instead of using @Request().
 */
export function parseAuthHeader(authHeader?: string): AuthUser {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  const payload = verifyAccessToken(token);

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

export function extractAuthUser(req: Request): AuthUser {
  return parseAuthHeader(req.headers.authorization);
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  req.user = extractAuthUser(req);
  next();
}