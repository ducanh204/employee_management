import { Role } from "../generated";

export interface AuthUser {
  departmentId: number | null;
  id: number;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
