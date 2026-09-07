import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "@/config/env";
import { Role } from "@/generated/browser";
import { UnauthorizedError } from "@/errors/app-error";

export interface AccessTokenPayload {
  departmentId: null;
  sub: number; // userId
  email: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError("Access token invalid or expired");
  }
}

/**
 * A refresh token is a random string (not a JWT) — the client keeps the
 * plaintext value, while the server stores only its hash (SHA-256) in the DB.
 * When the client sends it for a refresh, the server hashes it again and
 * compares it with the value stored in the DB — similar to password storage,
 * but without requiring a salt because this value is not user-selected
 * and already has sufficient random entropy.
 */
export function generateRefreshTokenPlain(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(plainToken: string): string {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}

export function getRefreshTokenExpiryDate(): Date {
  const days = env.jwt.refreshExpiresInDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}