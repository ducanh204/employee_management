// src/policies/permissions.ts
import { Role, ApprovalStatus } from '../generated/browser';

type Requester = { id: string; role: Role; departmentId: string | null };

export const can = {
  user: {
    create: (r: Requester) => r.role === 'ADMIN' || r.role === 'MANAGER',
    delete: (r: Requester, target: { role: Role; departmentId: string | null }) => {
      if (r.role === 'ADMIN') return true;
      if (r.role === 'MANAGER') return target.role === 'EMPLOYEE' && target.departmentId === r.departmentId;
      return false;
    },
    updateSelf: (r: Requester, targetId: string) => r.id === targetId,
  },

  project: {
    create: (r: Requester) => r.role === 'ADMIN' || r.role === 'MANAGER',
    update: (r: Requester, project: { managerId: string }) =>
      r.role === 'ADMIN' || (r.role === 'MANAGER' && project.managerId === r.id),
  },

  task: {
    create: (r: Requester) => r.role === 'ADMIN',
    approve: (r: Requester, task: { project: { departmentId: string } | null }) =>
      r.role === 'MANAGER' && task.project?.departmentId === r.departmentId,
    assign: (r: Requester, task: { approvalStatus: ApprovalStatus; project: { departmentId: string } | null }) => {
      if (task.approvalStatus !== 'APPROVED') return false;
      if (r.role === 'ADMIN') return true;
      return r.role === 'MANAGER' && task.project?.departmentId === r.departmentId;
    },
    updateProgress: (r: Requester, task: { assignedToId: string | null }) =>
      task.assignedToId === r.id,
  },
};