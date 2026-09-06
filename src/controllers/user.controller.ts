import {
  Controller,
  Get,
  Path,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";

import * as userService from "../services/user.service";
import { listUsersQuerySchema } from "../validators/user.validator";

@Route("users")
@Tags("Users")
@Security("jwt") // All routes in this controller require authentication
export class UserController extends Controller {
  @Get("/")
  public async list(
    @Query() page?: number,
    @Query() limit?: number,
    @Query() departmentId?: number
  ) {
    const query = listUsersQuerySchema.parse({
      page,
      limit,
      departmentId,
    });

    const result = await userService.getAllUsers(query);

    return result;
  }

  @Get("workload-report")
  @Security("jwt", ["ADMIN", "MANAGER"]) // Override: only ADMIN/MANAGER can access this route
  public async workloadReport() {
    const data = await userService.getUserWorkloadReport();

    // BigInt returned by COUNT() cannot be serialized to JSON by default,
    // so convert it to a number.
    return {
      data: data.map((row) => ({
        ...row,
        activeTaskCount: Number(row.activeTaskCount),
      })),
    };
  }

  @Get("{id}")
  public async getById(@Path() id: number) {
    const user = await userService.getUserById(id);

    return { data: user };
  }
}