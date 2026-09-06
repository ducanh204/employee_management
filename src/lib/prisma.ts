import { PrismaClient } from "../generated";

// Singleton: ensures the entire app uses only one PrismaClient instance.
//
// Important during development with hot-reload — each reload that creates a
// new PrismaClient() instance will open an additional connection pool,
// quickly exceeding the MySQL connection limit.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}