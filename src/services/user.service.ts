import { prisma } from "../lib/prisma";
import { NotFoundError } from "../errors/app-error";
import { ListUsersQuery } from "../validators/user.validator";

// Explicitly select only the required fields — do not use SELECT *
// (equivalent to "select all columns" in SQL). This prevents exposing
// the password hash and avoids unnecessarily large responses.
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

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSafeSelect,
  });

  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }

  return user;
}

/**
 * Example 1: JOIN through Prisma (the common approach, recommended for most cases).
 * Prisma automatically generates the SQL JOIN behind `select: { department: ... }`,
 * equivalent to:
 *   SELECT users.*, departments.id, departments.name
 *   FROM users
 *   LEFT JOIN departments ON users.department_id = departments.id
 */
export async function getAllUsers(query: ListUsersQuery) {
  const { page, limit, departmentId } = query;
  const skip = (page - 1) * limit;

  const where = departmentId ? { departmentId } : {};

  // Run two independent queries in parallel (count total + fetch current page)
  // instead of executing them sequentially.
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
 * Example 2: Actual raw SQL JOIN — demonstrates basic SQL JOIN syntax.
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