import { prisma } from "../lib/prisma";
import { NotFoundError, ConflictError } from "../errors/app-error";
import { CreateDepartmentDto, UpdateDepartmentDto } from "../validators/department.validator";
import { Prisma } from "@/generated/client";

export async function listDepartments() {
  return prisma.department.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

export async function getDepartment(id: number) {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department) {
    throw new NotFoundError(`Department ${id} not found`);
  }

  return department;
}

export async function createDepartment(input: CreateDepartmentDto) {
  try {
    return await prisma.department.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(`Department "${input.name}" already exists`);
    }
    throw err;
  }
}

export async function updateDepartment(id: number, input: UpdateDepartmentDto) {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department) {
    throw new NotFoundError(`Department ${id} not found`);
  }

  try {
    return await prisma.department.update({
      where: { id },
      data: input,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError(`Department "${input.name}" already exists`);
    }
    throw err;
  }
}

export async function deleteDepartment(id: number) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true },
      },
      projects: {
        select: { id: true },
      },
    },
  });

  if (!department) {
    throw new NotFoundError(`Department ${id} not found`);
  }

  if (department.users.length > 0) {
    throw new ConflictError("Cannot delete department that still has users");
  }

  if (department.projects.length > 0) {
    throw new ConflictError("Cannot delete department that still has projects");
  }

  return prisma.department.delete({
    where: { id },
  });
}