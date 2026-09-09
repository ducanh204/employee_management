import { Role } from "../generated/client";

type Requester = { id: number; role: Role; departmentId: number | null };
type TargetUser = { id: number; departmentId: number | null };

export const EMPLOYEE_EDITABLE_FIELDS = [
  "name",
  "avatarUrl",
  "phoneNumber",
  "password",
] as const;

export const userPolicy = {
  canListAll: (requester: Requester) => requester.role !== Role.EMPLOYEE,

  canView: (requester: Requester, target: TargetUser) => {
    if (requester.role === Role.ADMIN) return true;
    if (requester.role === Role.MANAGER) return target.departmentId === requester.departmentId;
    return requester.id === target.id;
  },

  canUpdate: (requester: Requester, target: TargetUser) =>
    userPolicy.canView(requester, target),

  canDelete: (requester: Requester, target: TargetUser) => {
    if (requester.role === Role.ADMIN) return true;
    if (requester.role === Role.MANAGER) return target.departmentId === requester.departmentId;
    return false; 
  },

  filterUpdatableFields: <T extends Record<string, unknown>>(requester: Requester, input: T): T => {
    if (requester.role !== Role.EMPLOYEE) return input;
    return Object.fromEntries(
      Object.entries(input).filter(([key]) =>
        (EMPLOYEE_EDITABLE_FIELDS as readonly string[]).includes(key)
      )
    ) as T;
  },
};