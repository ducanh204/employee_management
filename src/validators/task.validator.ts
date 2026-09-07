import { z } from "zod";
import { Difficulty, Priority, ProgressStatus } from "@/generated/client";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(255),
  description: z.string().optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  priority: z.nativeEnum(Priority).optional(),
  effort: z.coerce.number().int().positive("Effort must be a positive number"),
  projectId: z.coerce.number().int().positive().optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  progressStatus: z.nativeEnum(ProgressStatus).optional(),
});

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.coerce.number().int().positive().optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  progressStatus: z.nativeEnum(ProgressStatus).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
