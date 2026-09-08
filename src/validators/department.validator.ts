import { z } from "zod";

export interface CreateDepartmentDto {
  name: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
}

export const createDepartmentSchema: z.ZodType<CreateDepartmentDto> = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateDepartmentSchema: z.ZodType<UpdateDepartmentDto> = createDepartmentSchema.partial();
