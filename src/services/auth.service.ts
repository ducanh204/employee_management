import { prisma } from "../lib/prisma";
import { hashPassword, comparePassword } from "@/utils/password.util";
import {
  signAccessToken,
  generateRefreshTokenPlain,
  hashRefreshToken,
  getRefreshTokenExpiryDate,
} from "../utils/token.util";
import { ConflictError, UnauthorizedError } from "@/errors/app-error";
import { RegisterInput, LoginInput } from "@/validators/auth.validator";
import { logger } from "../utils/logger";

// Data returned to the client — NEVER expose the password field
function toSafeUser(user: {
  id: number;
  email: string;
  name: string;
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(
  user: { id: number; email: string; role: any }
): Promise<AuthTokens> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    departmentId: null, // departmentId is not included in the access token payload for now
  });

  const refreshTokenPlain = generateRefreshTokenPlain();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshTokenPlain),
      userId: user.id,
      expiresAt: getRefreshTokenExpiryDate(),
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenPlain,
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    // 409, not 400 — this is a conflict with an existing resource,
    // not an invalid input format.
    throw new ConflictError("Email already exists");
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
    },
  });

  logger.info("User registered", { userId: user.id });

  return toSafeUser(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Intentionally use the SAME error message for both
  // "email does not exist" and "incorrect password".
  // This prevents attackers from discovering whether an email
  // exists in the system.
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await comparePassword(
    input.password,
    user.password
  );

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = await issueTokenPair(user);

  logger.info("User logged in", { userId: user.id });

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

export async function refreshAccessToken(refreshTokenPlain: string) {
  const tokenHash = hashRefreshToken(refreshTokenPlain);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // A revoked token being submitted is highly suspicious.
  // The token may have been stolen, and an attacker could be
  // attempting to reuse an old token after the legitimate owner
  // has already rotated it.
  //
  // Safe response: revoke ALL refresh tokens belonging to this user
  // and force them to log in again.
  if (
    existingToken.revokedAt ||
    existingToken.expiresAt < new Date()
  ) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: existingToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    logger.warn(
      "Refresh token reuse or expiry detected — revoked all tokens",
      {
        userId: existingToken.userId,
      }
    );

    throw new UnauthorizedError(
      "Refresh token expired or already used, please login again"
    );
  }

  const user = existingToken.user;

  if (!user.isActive) {
    throw new UnauthorizedError("Account is deactivated");
  }

  // Transaction: revoking the old token and creating the new token
  // must either both succeed or both fail.
  //
  // Otherwise, there could be a gap where the old token is revoked
  // but the new token has not been created yet, causing the user
  // to be logged out unexpectedly.
  const newRefreshTokenPlain = generateRefreshTokenPlain();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    }),

    prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(newRefreshTokenPlain),
        userId: user.id,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    departmentId: null, // departmentId is not included in the access token payload for now
  });

  return {
    accessToken,
    refreshToken: newRefreshTokenPlain,
  };
}

export async function logout(refreshTokenPlain: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshTokenPlain);

  // Use updateMany instead of update.
  // If the token does not exist, there is simply nothing to revoke,
  // so there is no need to throw an error.
  //
  // Logout with an expired or invalid token should still succeed.
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function logoutAll(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  logger.info("All sessions revoked", { userId });
}