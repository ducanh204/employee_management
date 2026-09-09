import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "The password must be at least 8 characters long.")
    .regex(/[A-Z]/, "The password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "The password must contain at least one digit."),
  name: z.string().trim().min(1, "The name cannot be empty.").max(255),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "The password cannot be empty."),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "The refresh token is required."),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefresDto = z.infer<typeof refreshSchema>;
