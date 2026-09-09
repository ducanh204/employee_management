import { Role } from "../generated/client";

type Requester = { id: number; role: Role; departmentId: number | null };
type TargetProject ={ id: number;}