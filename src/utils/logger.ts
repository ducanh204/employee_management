/* eslint-disable no-console */
function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${timestamp()} - ${message}`, meta ?? "");
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${timestamp()} - ${message}`, meta ?? "");
  },
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${timestamp()} - ${message}`, meta ?? "");
  },
};
