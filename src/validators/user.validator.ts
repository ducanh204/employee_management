import { z } from "zod";
import { Role } from "../generated/client";

// Query parameters always appear as strings ("1", "20"), so they must be cast to numbers.
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  departmentId: z.coerce.number().int().positive().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.number().int().positive().optional(),
  avatarUrl: z.string().url().optional(),
  phoneNumber: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
  departmentId: z.number().int().positive().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role: z.nativeEnum(Role).optional(), // ADMIN only
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserDt0 = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// type UpdateUserInput = Partial<{
//   name: string;
//   isActive: boolean;
//   avatarUrl: string;
//   departmentId: number;
//   phoneNumber: string;
//   password: string;
//   role: Role; // ADMIN only
// }>;
