import { NextFunction, Request, Response } from "express";
import { Role } from "../generated";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

/**
 * authorize(["ADMIN", "MANAGER"]) -> only allows these two roles to proceed.
 * This middleware must always run AFTER authenticate, since it requires
 * req.user to be available.
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // An incorrect middleware order (authenticate was not applied first)
      // will be detected immediately here.
      throw new UnauthorizedError(
        "Authentication required before authorization"
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        "You do not have permission to perform this action"
      );
    }

    next();
  };
}