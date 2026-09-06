import { PrismaClient, Role } from "../src/generated";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const engineering = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: {
      name: "Engineering",
      description: "Engineering Department",
    },
  });

  const sales = await prisma.department.upsert({
    where: { name: "Sales" },
    update: {},
    create: {
      name: "Sales",
      description: "Sales Department",
    },
  });

  const passwordHash = await bcrypt.hash("Password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: passwordHash,
      name: "Admin User",
      role: Role.ADMIN,
      departmentId: engineering.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      password: passwordHash,
      name: "Manager User",
      role: Role.MANAGER,
      departmentId: engineering.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {},
    create: {
      email: "employee@example.com",
      password: passwordHash,
      name: "Employee User",
      role: Role.EMPLOYEE,
      departmentId: sales.id,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Website Revamp",
      description: "Company website redesign",
      departmentId: engineering.id,
      managerId: manager.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Design Homepage",
      effort: 5,
      projectId: project.id,
      createdById: manager.id,
      assignedToId: employee.id,
    },
  });

  console.log("Seed completed:", {
    admin: admin.email,
    manager: manager.email,
    employee: employee.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });