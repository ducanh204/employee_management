import { prisma } from "../lib/prisma";
import { ForbiddenError, NotFoundError } from "../errors/app-error";
import { ListUsersQuery } from "../validators/user.validator";
import { Role } from "../generated/client";
import { AuthUser } from "../types/express";
import { hashPassword } from "../utils/password.util";

// Explicitly select only the required fields — do not use SELECT *
// (equivalent to "select all columns" in SQL). This prevents exposing
// the password hash and avoids unnecessarily large responses.
type UpdateUserInput = Partial<{
  name: string;
  isActive: boolean;
  avatarUrl: string;
  departmentId: number;
  phoneNumber: string;
  password: string;
  role: Role; // ADMIN only
}>;

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

function assertCanViewUser(
  
  target: { id: number; department: { id: number } | null },
  currentUser: AuthUser
): void {
  if (currentUser.role === Role.ADMIN) return;

  if (currentUser.role === Role.MANAGER) {
    if (target.department?.id === currentUser.departmentId) return;
    throw new ForbiddenError("You can only view users in your own department");
  }

  // EMPLOYEE
  if (currentUser.id === target.id) return;
  throw new ForbiddenError("You are not allowed to view this user");
}

export async function getUserById(id: number, currentUser: AuthUser) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSafeSelect,
  });

  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }

  assertCanViewUser(user, currentUser);
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

/**
 * JOIN through Prisma (the common approach, recommended for most cases).
 * Prisma automatically generates the SQL JOIN behind `select: { department: ... }`,
 * equivalent to:
 *   SELECT users.*, departments.id, departments.name
 *   FROM users
 *   LEFT JOIN departments ON users.department_id = departments.id
 */
export async function getAllUsers(query: ListUsersQuery, currentUser: AuthUser) {
  if (currentUser.role === Role.EMPLOYEE) {
    throw new ForbiddenError("You are not allowed to view the list of users");
  }

  const { page, limit, departmentId } = query;
  const skip = (page - 1) * limit;
  
  const where = currentUser.role === Role.MANAGER
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

/**
 * Actual raw SQL JOIN — demonstrates basic SQL JOIN syntax.
 * This approach is useful for complex queries that cannot be expressed
 * cleanly through the Prisma Client API
 * (e.g. JOINing multiple tables and performing aggregations at the same time).
 *
 * Query: count the number of active tasks for each user, along with the
 * department name — INNER JOIN users with departments, LEFT JOIN with tasks
 * (so users without any tasks are still included with count = 0).
 */
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


// Fields an EMPLOYEE is allowed to touch on their own account.
// isActive / departmentId are admin-only.
const EMPLOYEE_EDITABLE_FIELDS = [
  "name",
  "avatarUrl",
  "phoneNumber",
  "password",
] as const;

/** UPDATE USER
 * Role-based access control (RBAC) rules:
 * ADMIN: can update anyone, any field.
 * EMPLOYEE: can update only their own account, and only a safe subset of fields.
 * MANAGER: can update users within their department (per current spec — only create/get/read/delete).
 */
export async function updateUser(
  id: number,
  input: UpdateUserInput,
  currentUser: AuthUser
) {
  const targetUser = await prisma.user.findUnique({where: { id }});

  if (!targetUser) {
    throw new NotFoundError(`User ${id} not found`);
  }
  let data: UpdateUserInput = input;
  // Employee can only update their own profile, and only a safe subset of fields.
  if (currentUser.role === Role.EMPLOYEE) {
    if (currentUser.id !== id) {
      throw new ForbiddenError("You can only update your own profile");
    }

    // Filter out any fields that are not allowed for EMPLOYEE to update
    data = Object.fromEntries(
      Object.entries(input).filter(([key]) =>
        (EMPLOYEE_EDITABLE_FIELDS as readonly string[]).includes(key)
      )
    ) as UpdateUserInput;
  } else if (currentUser.role === Role.MANAGER) {
    if (currentUser.departmentId !== targetUser.departmentId) {
      throw new ForbiddenError("Managers are not allowed to update users from other departments");
    }
  } else {
    // ADMIN can update anyone, any field — no restrictions
  }

 if (data.password) {
  data.password = await hashPassword(data.password);
}
  return prisma.user.update({
    where: { id },
    data,
    select: userSafeSelect,
  });
  
}

/** DELETE USER
 * Role-based access control (RBAC) rules:
 * ADMIN: can delete anyone.
 * EMPLOYEE: cannot delete any account.
 * MANAGER: can delete users within their department (per current spec — only create/get/read/delete).
 */

export async function deleteUser(id: number, currentUser: AuthUser) {
  const targetUser = await prisma.user.findUnique({where: { id }});

  if (!targetUser) {
    throw new NotFoundError(`User ${id} not found`);
  }

  if (currentUser.role === Role.EMPLOYEE) {
    throw new ForbiddenError("You are not allowed to delete any user");
  }

  if (currentUser.role === Role.MANAGER) {
    if (currentUser.departmentId !== targetUser.departmentId) {
      throw new ForbiddenError("Managers are not allowed to delete users from other departments");
    }
  }
  
  await prisma.user.delete({ where: { id } }); 
}

