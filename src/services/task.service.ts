import { prisma } from "../lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../errors/app-error";
import { AuthUser } from "../types/express";
import { Role, ProgressStatus, Prisma } from "../generated/client";
import { isProjectMember } from "./project.service";
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
} from "../validators/task.validator";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  difficulty: true,
  priority: true,
  effort: true,
  approvalStatus: true,
  progressStatus: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
} satisfies Prisma.TaskSelect;


async function assertProjectMembershipIfNeeded(
  projectId: number | undefined,
  userId: number
): Promise<void> {
  if (!projectId) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true },
  });

  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  if (project.managerId === userId) return;

  const member = await isProjectMember(projectId, userId);

  if (!member) {
    throw new ForbiddenError(
      "You must be a member of this project to do that"
    );
  }
}

async function assertAssigneeIsProjectMember(
  projectId: number | undefined,
  assignedToId: number | undefined
): Promise<void> {
  if (!projectId || !assignedToId) return;

  const isMember = await isProjectMember(projectId, assignedToId);

  if (!isMember) {
    throw new BadRequestError(
      "assignedToId must be a member of the project"
    );
  }
}

export async function createTask(
  input: CreateTaskInput,
  requester: AuthUser
) {
  if (requester.role !== Role.ADMIN) {
    await assertProjectMembershipIfNeeded(
      input.projectId,
      requester.id
    );
  }

  await assertAssigneeIsProjectMember(
    input.projectId,
    input.assignedToId
  );

  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      priority: input.priority,
      effort: input.effort,
      projectId: input.projectId,
      assignedToId: input.assignedToId,
      createdById: requester.id,
      startDate: input.startDate,
      dueDate: input.dueDate,
    },
    select: taskSelect,
  });
}

export async function getAllTasks(query: ListTasksQuery) {
  const {
    page,
    limit,
    projectId,
    assignedToId,
    progressStatus,
  } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.TaskWhereInput = {
    ...(projectId ? { projectId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(progressStatus ? { progressStatus } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: taskSelect,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.task.count({ where }),
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

export async function getTaskById(id: number) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: taskSelect,
  });

  if (!task) {
    throw new NotFoundError(`Task ${id} not found`);
  }

  return task;
}

/**
 * Users who can modify a task:
 * - The task creator
 * - The assigned user
 * - The manager of the project containing the task
 * - ADMIN
 */
async function assertCanModifyTask(
  taskId: number,
  requester: AuthUser
): Promise<{ projectId: number | null }> {
  if (requester.role === Role.ADMIN) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }

    return task;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      createdById: true,
      assignedToId: true,
      project: {
        select: {
          managerId: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  const isOwnerOrAssignee =
    task.createdById === requester.id ||
    task.assignedToId === requester.id;

  const isProjectManager =
    task.project?.managerId === requester.id;

  if (!isOwnerOrAssignee && !isProjectManager) {
    throw new ForbiddenError(
      "You do not have permission to modify this task"
    );
  }

  return { projectId: task.projectId };
}

export async function updateTask(
  id: number,
  input: UpdateTaskInput,
  requester: AuthUser
) {
  const { projectId } = await assertCanModifyTask(id, requester);

  if (input.assignedToId !== undefined) {
    await assertAssigneeIsProjectMember(
      projectId ?? undefined,
      input.assignedToId
    );
  }

  // Business rule: when a task is moved to DONE,
  // automatically set completedAt instead of requiring
  // the client to provide it manually.
  const completedAt =
    input.progressStatus === ProgressStatus.DONE
      ? new Date()
      : undefined;

  return prisma.task.update({
    where: { id },
    data: {
      ...input,
      ...(completedAt ? { completedAt } : {}),
    },
    select: taskSelect,
  });
}

export async function deleteTask(
  id: number,
  requester: AuthUser
): Promise<void> {
  await assertCanModifyTask(id, requester);

  await prisma.task.delete({
    where: { id },
  });
}

