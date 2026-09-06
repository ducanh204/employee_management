import "dotenv/config";

interface EnvConfig {
  port: number;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string; // e.g. "15m"
    refreshExpiresInDays: number; // e.g. 7
  };
}

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    // Fail fast: it's better to crash when the server starts
    // than to encounter an unclear error at runtime.
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env: EnvConfig = {
  port: Number(process.env.PORT ?? 4000),

  databaseUrl: required("DATABASE_URL"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresInDays: Number(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7
    ),
  },
};