import {
  Body,
  Controller,
  Post,
  Route,
  SuccessResponse,
  Tags,
  Security,
  RequestProp,
} from "tsoa";

import * as authService from "../services/auth.service";

import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../validators/auth.validator";

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  @Post("register")
  @SuccessResponse(201, "Created")
  public async register(@Body() body: RegisterBody) {
    const input = registerSchema.parse(body);
    const user = await authService.register(input);

    this.setStatus(201);

    return { data: user };
  }

  @Post("login")
  public async login(@Body() body: LoginBody) {
    const input = loginSchema.parse(body);
    const result = await authService.login(input);

    return { data: result };
  }

  @Post("refresh")
  public async refresh(@Body() body: RefreshBody) {
    const input = refreshSchema.parse(body);
    const tokens = await authService.refreshAccessToken(
      input.refreshToken
    );

    return { data: tokens };
  }

  @Post("logout")
  public async logout(@Body() body: RefreshBody) {
    const input = refreshSchema.parse(body);

    await authService.logout(input.refreshToken);

    this.setStatus(204);
    return;
  }

  @Security("jwt")
  @Post("logout-all")
  public async logoutAll(
    @RequestProp("user") user: { id: number }
  ) {
    await authService.logoutAll(user.id);

    this.setStatus(204);
    return;
  }
}