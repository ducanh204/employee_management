import { prisma } from "../lib/prisma";
import { ForbiddenError, NotFoundError } from "../errors/app-error";
import { ListUsersQuery, UpdateUserDto } from "../validators/user.validator";
import { Role } from "../generated/client";
import { AuthUser } from "../types/express";
import { hashPassword } from "../utils/password.util";
import { userPolicy } from "../policies/user.policy";


const userSafeSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
  department: { select: { id: true, name: true } }, // JOIN through Prisma include/select
} as const;

export async function getUserById(id: number, currentUser: AuthUser) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSafeSelect });
  if (!user) throw new NotFoundError(`User ${id} not found`);

  if (!userPolicy.canView(currentUser, { id: user.id, departmentId: user.department?.id ?? null })) {
    throw new ForbiddenError("You are not allowed to view this user");
  }
  return user;
}

// GET /users/me
export async function getCurrentUserProfile(currentUser: AuthUser) {
  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: userSafeSelect,
  });

  if (!user) {
    throw new NotFoundError(`User ${currentUser.id} not found`);
  }

  return user;
}

export async function getAllUsers(query: ListUsersQuery, currentUser: AuthUser) {
  if (!userPolicy.canListAll(currentUser)) {
    throw new ForbiddenError("You are not allowed to view the list of users");
  }

  const { page, limit, departmentId } = query;
  const skip = (page - 1) * limit;

  const where =
    currentUser.role === Role.MANAGER
      ? { departmentId: currentUser.departmentId }
      : departmentId
      ? { departmentId }
      : {};

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSafeSelect,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getUserWorkloadReport() {
  return prisma.$queryRaw<
    Array<{
      userId: number;
      userName: string;
      departmentName: string | null;
      activeTaskCount: bigint;
    }>
  >`
    SELECT
      u.id AS userId,
      u.name AS userName,
      d.name AS departmentName,
      COUNT(t.id) AS activeTaskCount
    FROM users u
    LEFT JOIN departments d ON u.\`departmentId\` = d.id
    LEFT JOIN tasks t
      ON t.\`assignedToId\` = u.id
      AND t.\`progressStatus\` IN ('NOT_STARTED', 'IN_PROGRESS')
    WHERE u.\`isActive\` = true
    GROUP BY u.id, u.name, d.name
    ORDER BY activeTaskCount DESC
  `;
}

/** UPDATE USER
 * Role-based access control (RBAC) rules:
 * ADMIN: can update anyone, any field.
 * EMPLOYEE: can update only their own account, and only a safe subset of fields.
 * MANAGER: can update users within their department (per current spec — only create/get/read/delete).
 */
export async function updateUser(id: number, input: UpdateUserDto, currentUser: AuthUser) {
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError(`User ${id} not found`);

  if (!userPolicy.canUpdate(currentUser, targetUser)) {
    throw new ForbiddenError("You are not allowed to update this user");
  }

  const data = userPolicy.filterUpdatableFields(currentUser, input);
  if (data.password) {
    data.password = await hashPassword(data.password);
  }

  return prisma.user.update({
    where: { id },
    data,
    select: userSafeSelect,
  });
}

export async function deleteUser(id: number, currentUser: AuthUser) {
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError(`User ${id} not found`);

  if (!userPolicy.canDelete(currentUser, targetUser)) {
    throw new ForbiddenError("You are not allowed to delete this user");
  }

  await prisma.user.delete({ where: { id } });
}