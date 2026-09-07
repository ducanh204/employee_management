import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Path,
  Post,
  Put,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";

import * as projectService from "@/services/project.service";
import { parseAuthHeader } from "@/middleware/authenticate";

import {
  createProjectSchema,
  updateProjectSchema,
  addMemberSchema,
  listProjectsQuerySchema,
} from "../validators/project.validator";

interface CreateProjectBody {
  name: string;
  description?: string;
  departmentId?: number;
  managerId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface UpdateProjectBody extends Partial<CreateProjectBody> {}

interface AddMemberBody {
  userId: number;
}

@Route("projects")
@Tags("Projects")
@Security("jwt") // All routes in this controller require authentication
export class ProjectController extends Controller {
  @Get("/")
  public async list(
    @Query() page?: number,
    @Query() limit?: number,
    @Query() departmentId?: number,
    @Query() status?: string
  ) {
    const query = listProjectsQuerySchema.parse({
      page,
      limit,
      departmentId,
      status,
    });

    return projectService.getAllProjects(query);
  }

  @Get("{id}")
  public async getById(@Path() id: number) {
    const data = await projectService.getProjectById(id);
    return { data };
  }

  @Post("/")
  public async create(
    @Header("authorization") authorization: string,
    @Body() body: CreateProjectBody
  ) {
    // Use parseAuthHeader instead of @Request().
    // @Security above already blocks requests without a valid token.
    // Here, parseAuthHeader is only used to retrieve the authenticated
    // user's information (id, role) for the service layer.
    const requester = parseAuthHeader(authorization);

    const input = createProjectSchema.parse(body);
    const data = await projectService.createProject(input, requester);

    this.setStatus(201);

    return { data };
  }

  @Put("{id}")
  public async update(
    @Path() id: number,
    @Header("authorization") authorization: string,
    @Body() body: UpdateProjectBody
  ) {
    const requester = parseAuthHeader(authorization);

    const input = updateProjectSchema.parse(body);
    const data = await projectService.updateProject(id, input, requester);

    return { data };
  }

  @Delete("{id}")
  public async remove(
    @Path() id: number,
    @Header("authorization") authorization: string
  ) {
    const requester = parseAuthHeader(authorization);

    await projectService.deleteProject(id, requester);

    this.setStatus(204);
    return;
  }

  @Post("{id}/members")
  public async addMember(
    @Path() id: number,
    @Header("authorization") authorization: string,
    @Body() body: AddMemberBody
  ) {
    const requester = parseAuthHeader(authorization);

    const input = addMemberSchema.parse(body);
    const data = await projectService.addMember(
      id,
      input.userId,
      requester
    );

    this.setStatus(201);

    return { data };
  }

  @Delete("{id}/members/{userId}")
  public async removeMember(
    @Path() id: number,
    @Path() userId: number,
    @Header("authorization") authorization: string
  ) {
    const requester = parseAuthHeader(authorization);

    await projectService.removeMember(id, userId, requester);

    this.setStatus(204);
    return;
  }
}