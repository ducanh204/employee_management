import { Request } from "express";
import { extractAuthUser } from "./authenticate";
import { ForbiddenError } from "../errors/app-error";
import { AuthUser } from "../types/express";
import { Role } from "../generated";

/**
 * Tsoa calls this function for every endpoint that uses
 * @Security("jwt", [...roles]).
 *
 * The scopes parameter is reused as the list of allowed roles.
 * This is equivalent to calling authenticate() followed by
 * authorize(scopes), but follows the contract required by tsoa:
 * a single authentication function configured in tsoa.json.
 *
 * Configuration required in tsoa.json:
 *   "authenticationModule": "./src/middleware/tsoaAuthentication.ts"
 */
export async function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<AuthUser> {
  if (securityName !== "jwt") {
    throw new ForbiddenError(`Unsupported security scheme: ${securityName}`);
  }

  const user = extractAuthUser(request);

  if (scopes && scopes.length > 0 && !scopes.includes(user.role as Role)) {
    throw new ForbiddenError(
      "You do not have permission to perform this action"
    );
  }

  return user;
}