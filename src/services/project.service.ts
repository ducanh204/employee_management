import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../errors/app-error";
import { AuthUser } from "../types/express";
import { Role, Prisma } from "../generated/client";
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsQuery,
} from "../validators/project.validator";

const projectSummarySelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      members: true,
      tasks: true,
    },
  },
  createdAt: true,
} satisfies Prisma.ProjectSelect;

function isAdminOrManagerRole(user: AuthUser): boolean {
  return user.role === Role.ADMIN || user.role === Role.MANAGER;
}

/**
 * Check whether a user can manage a specific project.
 * Only ADMIN or the project's assigned manager is allowed.
 *
 * This is a dynamic authorization check because it depends on the project data.
 * Therefore, it cannot be handled by tsoa's static @Security scopes
 * and must be implemented in the service layer.
 */
async function assertCanManageProject(
  projectId: number,
  user: AuthUser
): Promise<void> {
  if (user.role === Role.ADMIN) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true },
  });

  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  if (project.managerId !== user.id) {
    throw new ForbiddenError(
      "Only the project's manager or an admin can perform this action"
    );
  }
}

export async function createProject(
  input: CreateProjectInput,
  requester: AuthUser
) {
  if (!isAdminOrManagerRole(requester)) {
    throw new ForbiddenError("Only ADMIN or MANAGER can create projects");
  }

  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      departmentId: input.departmentId,
      managerId: input.managerId ?? requester.id,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    },
    select: projectSummarySelect,
  });
}

export async function getAllProjects(query: ListProjectsQuery) {
  const { page, limit, departmentId, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ProjectWhereInput = {
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: projectSummarySelect,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.project.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProjectById(id: number) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      ...projectSummarySelect,
      members: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          joinedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundError(`Project ${id} not found`);
  }

  return project;
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput,
  requester: AuthUser
) {
  await assertCanManageProject(id, requester);

  return prisma.project.update({
    where: { id },
    data: input,
    select: projectSummarySelect,
  });
}

export async function deleteProject(
  id: number,
  requester: AuthUser
): Promise<void> {
  await assertCanManageProject(id, requester);

  // Task.projectId is an optional relation with SetNull behavior when
  // the project is deleted. Tasks are preserved, but their project
  // association is removed. This cascade behavior is already defined
  // in the schema, so no additional handling is required here.
  await prisma.project.delete({
    where: { id },
  });
}

export async function addMember(
  projectId: number,
  userId: number,
  requester: AuthUser
) {
  await assertCanManageProject(projectId, requester);

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    throw new NotFoundError(`User ${userId} not found`);
  }

  try {
    return await prisma.projectMember.create({
      data: {
        projectId,
        userId,
      },
      select: {
        id: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictError(
        "User is already a member of this project"
      );
    }

    throw err;
  }
}

export async function removeMember(
  projectId: number,
  userId: number,
  requester: AuthUser
): Promise<void> {
  await assertCanManageProject(projectId, requester);

  await prisma.projectMember.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
}

/**
 * Shared by task.service to check whether a user is a member
 * of the specified project.
 */
export async function isProjectMember(
  projectId: number,
  userId: number
): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  return !!member;
}