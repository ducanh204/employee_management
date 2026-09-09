import { z } from "zod";
import { ProjectStatus } from "@/generated/client";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(255),
  description: z.string().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  managerId: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const addMemberSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
