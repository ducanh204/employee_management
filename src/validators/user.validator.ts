import { z } from "zod";

// Query params luôn đến dưới dạng string ("1", "20") nên phải coerce sang number
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  departmentId: z.coerce.number().int().positive().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
