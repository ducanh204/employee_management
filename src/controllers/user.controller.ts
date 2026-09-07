import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Path,
  Post,
  Put,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";

import * as userService from "@/services/user.service";
import { parseAuthHeader } from "@/middleware/authenticate";

import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from "@/validators/user.validator";

interface CreateUserBody {
  email: string;
  password: string;
  name: string;
  role?: string;
  departmentId?: number;
  avatarUrl?: string;
  phoneNumber?: string;
}

interface UpdateUserBody {
  name?: string;
  isActive?: boolean;
  avatarUrl?: string;
  departmentId?: number;
  phoneNumber?: string;
  password?: string;
  role?: string; // ADMIN only
}

@Route("users")
@Tags("Users")
@Security("jwt")
export class UserController extends Controller {
  // Đặt "me" TRƯỚC "{id}" — nếu để sau, Express sẽ match /users/me
  // vào route {id} (hiểu "me" là id) trước khi tới được route này.
  @Get("me")
  public async getMe(@Header("authorization") authorization: string) {
    const requester = parseAuthHeader(authorization);
    const data = await userService.getCurrentUserProfile(requester);
    return { data };
  }

  @Get("/")
  public async list(
    @Header("authorization") authorization: string,
    @Query() page?: number,
    @Query() limit?: number,
    @Query() departmentId?: number
  ) {
    const requester = parseAuthHeader(authorization);
    const query = listUsersQuerySchema.parse({ page, limit, departmentId });

    return userService.getAllUsers(query, requester);
  }

  @Get("{id}")
  public async getById(
    @Path() id: number,
    @Header("authorization") authorization: string
  ) {
    const requester = parseAuthHeader(authorization);
    const data = await userService.getUserById(id, requester);
    return { data };
  }

  // @Post("/")
  // public async create(
  //   @Header("authorization") authorization: string,
  //   @Body() body: CreateUserBody
  // ) {
  //   const requester = parseAuthHeader(authorization);
  //   const input = createUserSchema.parse(body);
  //   const data = await userService.createUser(input, requester);

  //   this.setStatus(201);
  //   return { data };
  // }

  @Patch("{id}")
  public async update(
    @Path() id: number,
    @Header("authorization") authorization: string,
    @Body() body: UpdateUserBody
  ) {
    const requester = parseAuthHeader(authorization);
    const input = updateUserSchema.parse(body);
    const data = await userService.updateUser(id, input, requester);

    return { data };
  }

  @Delete("{id}")
  public async remove(
    @Path() id: number,
    @Header("authorization") authorization: string
  ) {
    const requester = parseAuthHeader(authorization);
    await userService.deleteUser(id, requester);

    this.setStatus(204);
    return;
  }
}